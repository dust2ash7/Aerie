import { setModWheel } from "@/aerie/sound";

type Handlers = {
  note: (midi: number, vel: number, down: boolean) => void;
  status: (text: string) => void;
};

const UNSUPPORTED = "MIDI needs Chrome, Edge, or Firefox on a computer. Play on-screen for now.";

class WebMidi {
  private access: MIDIAccess | null = null;
  private input: MIDIInput | null = null;
  private handlers: Handlers | null = null;
  private sustained = new Set<number>();
  private held = new Set<number>();
  echo = false;
  portId: string | null = null;
  sustain = false;

  supported(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
  }

  async connect(handlers: Handlers, portId: string | null, echo: boolean) {
    this.handlers = handlers;
    this.echo = echo;
    this.portId = portId;
    if (!this.supported()) {
      handlers.status(UNSUPPORTED);
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      handlers.status(UNSUPPORTED);
      return;
    }
    this.access.onstatechange = () => this.bind();
    this.bind();
  }

  setEcho(on: boolean) {
    this.echo = on;
  }

  pick(id: string | null) {
    this.portId = id;
    this.bind();
  }

  private bind() {
    if (!this.access || !this.handlers) return;
    const inputs = [...this.access.inputs.values()];
    if (this.input) {
      this.input.onmidimessage = null;
      this.input = null;
    }
    const chosen = inputs.find((i) => i.id === this.portId) ?? inputs[0] ?? null;
    if (!chosen) {
      this.handlers.status("MIDI off");
      return;
    }
    this.portId = chosen.id;
    this.input = chosen;
    this.input.onmidimessage = (ev) => this.onMessage(ev);
    this.handlers.status(`MIDI • ${chosen.name || "device"}`);
  }

  private onMessage(ev: MIDIMessageEvent) {
    const data = ev.data;
    if (!data || data.length < 1 || !this.handlers) return;
    const status = data[0];
    if (status === 0xf8 || status === 0xfe) return;
    const cmd = status & 0xf0;
    if (this.echo && this.access) {
      const outputs = [...this.access.outputs.values()];
      outputs[0]?.send(data);
    }
    if (cmd === 0x90 || cmd === 0x80) {
      const midi = data[1] ?? 0;
      const vel = (data[2] ?? 0) / 127;
      const down = cmd === 0x90 && vel > 0;
      if (down) {
        this.held.add(midi);
        this.handlers.note(midi, vel, true);
        return;
      }
      if (this.sustain) {
        this.sustained.add(midi);
        this.held.delete(midi);
        return;
      }
      this.held.delete(midi);
      this.handlers.note(midi, 0, false);
      return;
    }
    if (cmd === 0xb0) {
      const cc = data[1] ?? 0;
      const val = data[2] ?? 0;
      if (cc === 64) {
        this.sustain = val >= 64;
        if (!this.sustain) {
          for (const midi of this.sustained) this.handlers.note(midi, 0, false);
          this.sustained.clear();
        }
      } else if (cc === 1) {
        setModWheel(val / 127);
      }
    }
  }
}

export const webmidi = new WebMidi();
