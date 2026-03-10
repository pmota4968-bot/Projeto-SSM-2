
// @ts-ignore
const Peer = (window as any).Peer;

export interface WebRTCState {
    peerId: string | null;
    isConnected: boolean;
    incomingCall: any | null;
    activeCall: any | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isVolumeActive: boolean;
    isVideoActive: boolean;
}

export class WebRTCService {
    private peer: any = null;
    private currentCall: any = null;
    private onStateChange: (state: Partial<WebRTCState>) => void;

    constructor(onStateChange: (state: Partial<WebRTCState>) => void) {
        this.onStateChange = onStateChange;
    }

    initialize(id: string) {
        if (this.peer) return;

        // Usando o servidor público do PeerJS para facilidade de uso profissional
        this.peer = new Peer(id, {
            debug: 2
        });

        this.peer.on('open', (id: string) => {
            this.onStateChange({ peerId: id, isConnected: true });
        });

        this.peer.on('call', (call: any) => {
            this.onStateChange({ incomingCall: call });
        });

        this.peer.on('error', (err: any) => {
            console.error('PeerJS Error:', err);
            if (err.type === 'peer-unavailable') {
                alert('Destinatário não está online no momento.');
            }
        });
    }

    async startCall(targetId: string, video: boolean = false) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: video,
                audio: true
            });

            this.onStateChange({ localStream: stream, isVideoActive: video, isVolumeActive: true });

            const call = this.peer.call(targetId, stream);
            this.setupCallListeners(call);
            this.currentCall = call;
            this.onStateChange({ activeCall: call });
        } catch (err) {
            console.error('Erro ao acessar média:', err);
            alert('Não foi possível aceder à câmara ou microfone.');
        }
    }

    answerCall(call: any, video: boolean = false) {
        navigator.mediaDevices.getUserMedia({ video, audio: true }).then(stream => {
            this.onStateChange({ localStream: stream, isVideoActive: video, isVolumeActive: true, incomingCall: null });
            call.answer(stream);
            this.setupCallListeners(call);
            this.currentCall = call;
            this.onStateChange({ activeCall: call });
        });
    }

    private setupCallListeners(call: any) {
        call.on('stream', (remoteStream: MediaStream) => {
            this.onStateChange({ remoteStream });
        });

        call.on('close', () => {
            this.endCall();
        });

        call.on('error', () => {
            this.endCall();
        });
    }

    endCall() {
        if (this.currentCall) {
            this.currentCall.close();
            this.currentCall = null;
        }

        // Stop tracks
        const state: any = (window as any)._webrtc_state; // Hack for cleanup if needed, but better to manage in component

        this.onStateChange({
            activeCall: null,
            incomingCall: null,
            remoteStream: null,
            localStream: null
        });
    }

    destroy() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }
}
