import { SettingsSection } from "spcr-settings";
import { APP_CONFIG } from "./config";

export const SETTINGS_SCHEMA: Record<string, any> = {
    link: { id: "catjam-webm-link", label: "Custom webM video URL", type: "input", default: "" },
    bpm: { id: "catjam-webm-bpm", label: "Custom default BPM", type: "number", default: APP_CONFIG.DEFAULTS.BPM },
    position: { 
        id: "catjam-webm-position", 
        label: "Position", 
        type: "dropdown", 
        options: [APP_CONFIG.LABELS.POSITION.BOTTOM, APP_CONFIG.LABELS.POSITION.LEFT], 
        default: APP_CONFIG.LABELS.POSITION.BOTTOM 
    },
    bpmMethod: { 
        id: "catjam-webm-bpm-method", 
        label: "Lowering Method", 
        type: "dropdown", 
        options: [APP_CONFIG.LABELS.METHOD.TRACK, APP_CONFIG.LABELS.METHOD.ADVANCED], 
        default: APP_CONFIG.LABELS.METHOD.TRACK 
    },
    bpmMethodFaster: { 
        id: "catjam-webm-bpm-method-faster-songs", 
        label: "Faster Method", 
        type: "dropdown", 
        options: [APP_CONFIG.LABELS.METHOD.TRACK, APP_CONFIG.LABELS.METHOD.ADVANCED], 
        default: APP_CONFIG.LABELS.METHOD.TRACK 
    },
    size: { id: "catjam-webm-position-left-size", label: "Left Size (%)", type: "number", default: APP_CONFIG.DEFAULTS.SIZE },
};

export const settings = new SettingsSection("Cat-Jam Settings", "catjam-settings");

export const cachedSettings = new Proxy({} as any, {
    get: (_, prop: string) => {
        const schema = SETTINGS_SCHEMA[prop as keyof typeof SETTINGS_SCHEMA];
        if (!schema) return undefined;
        
        const value = settings.getFieldValue(schema.id);
        if (value === null || value === undefined || value === "") {
            return schema.default;
        }
        
        if (schema.type === "number") {
            const num = Number(value);
            return isNaN(num) ? schema.default : num;
        }
        
        return value;
    }
});
