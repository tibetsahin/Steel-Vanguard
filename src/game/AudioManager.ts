export class AudioManager {
    private static instance: AudioManager;
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private enabled: boolean = true;
    private engineSound: HTMLAudioElement | null = null;

    private constructor() {
        this.loadSound('shoot', 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        this.loadSound('explosion', 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
        this.loadSound('pickup', 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
        this.loadSound('hit', 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
        this.loadSound('mg', 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3');
        
        // Engine sound setup
        this.engineSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2565/2565-preview.mp3');
        this.engineSound.loop = true;
        this.engineSound.volume = 0.1;
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private loadSound(name: string, url: string) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.sounds.set(name, audio);
    }

    public play(name: string, volume: number = 0.5) {
        if (!this.enabled) return;
        const sound = this.sounds.get(name);
        if (sound) {
            const clone = sound.cloneNode() as HTMLAudioElement;
            clone.volume = volume;
            clone.play().catch(() => {}); // Ignore autoplay restrictions
        }
    }

    public startEngine() {
        if (!this.enabled || !this.engineSound) return;
        this.engineSound.play().catch(() => {});
    }

    public stopEngine() {
        if (this.engineSound) {
            this.engineSound.pause();
        }
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            this.stopEngine();
        } else if (this.engineSound && !this.engineSound.paused) {
            this.startEngine();
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }
}
