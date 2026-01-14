import { create } from "zustand"
import { connectGmail, fetchLabels, saveSelectedLabels } from "@/services/gmail"
import { GmailLabel } from "@/shared/types/GmailTypes"

type Step = "idle" | "labels" | "saving";

interface GmailState {
    open: boolean;
    step: Step;
    labels: GmailLabel[];
    selected: GmailLabel[];
    loading: boolean;
    error: string | null;

    openModal: () => void;
    closeModal: () => void;

    startConnect: () => Promise<void>;
    loadLabels: () => Promise<void>;
    toggleLabel: (label: GmailLabel) => void;
    saveLabels: () => Promise<void>;
}

export const useGmailStore = create<GmailState>((set, get) => ({
    open: false,
    step: "idle",
    labels: [],
    selected: [],
    loading: false,
    error: null,

    openModal: () => set({ open: true, error: null }),
    closeModal: () =>
        set({
            open: false,
            step: "idle",
            labels: [],
            selected: [],
            error: null
        }),

    startConnect: async () => {
        try {
            const { auth_url } = await connectGmail();
            window.location.href = auth_url;
        } catch {
            set({ error: "Failed to connect to Gmail" });
        }
    },
    loadLabels: async () => {
        try {
            set({ loading: true, error: null });
            const labels = await fetchLabels();
            set({ labels: Array.isArray(labels) ? labels : [], loading: false });
        } catch (err) {
            set({ error: "Failed to load labels", labels: [], loading: false });
        }
    },
    toggleLabel: (label: GmailLabel) => {
        const selected = get().selected;

        const exists = selected.find(l => l.id === label.id);

        set({
            selected: exists
                ? selected.filter(l => l.id !== label.id)
                : [...selected, label],
        });
    },
    saveLabels: async () => {
        try {
            set({ step: "saving" });
            await saveSelectedLabels(get().selected);
            set({
                open: false,
                step: "idle",
                labels: [],
                selected: [],
            });
        } catch {
            set({ error: "Failed to save labels", step: "labels" });
        }
    }
}));