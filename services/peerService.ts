import { Peer, DataConnection } from "peerjs";
import { NetworkPacket, PacketType } from "../types";

export class PeerService {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  onDataCallback: ((packet: NetworkPacket) => void) | null = null;
  onConnectCallback: (() => void) | null = null;
  onCloseCallback: (() => void) | null = null;

  async initialize(customId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Se já houver uma instância, destrói antes de criar nova
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      const peer = customId ? new Peer(customId) : new Peer();
      
      peer.on('open', (id) => {
        this.peer = peer;
        console.log('My Peer ID:', id);
        
        peer.on('connection', (conn) => {
          this.handleConnection(conn);
        });
        
        resolve(id);
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        
        // Se o ID estiver indisponível, rejeita com erro específico
        if (err.type === 'unavailable-id') {
           reject(new Error('ID_TAKEN'));
        } else if (err.type === 'peer-unavailable') {
           // Isso acontece ao tentar conectar a alguém que não existe, não ao inicializar
           // Ignoramos aqui pois é tratado no connect()
        } else {
           reject(err);
        }
      });
    });
  }

  connect(remotePeerId: string) {
    if (!this.peer) return;
    
    // Se já tiver conexão, ignora
    if (this.conn && this.conn.open) return;

    console.log("Tentando conectar a:", remotePeerId);
    const conn = this.peer.connect(remotePeerId, {
      reliable: true
    });
    this.handleConnection(conn);
  }

  private handleConnection(conn: DataConnection) {
    if (this.conn && this.conn.open) {
        // Se recebermos uma nova conexão válida, fechamos a antiga se necessário
        // ou mantemos a nova. Vamos aceitar a nova para reconexões.
        this.conn.close();
    }

    this.conn = conn;

    conn.on('open', () => {
      console.log('Conectado com:', conn.peer);
      if (this.onConnectCallback) this.onConnectCallback();
    });

    conn.on('data', (data) => {
      if (this.onDataCallback) {
        this.onDataCallback(data as NetworkPacket);
      }
    });

    conn.on('close', () => {
      console.log('Conexão fechada');
      this.conn = null;
      if (this.onCloseCallback) this.onCloseCallback();
    });

    conn.on('error', (err) => {
      console.error('Erro na conexão:', err);
      // Não chamamos onCloseCallback aqui imediatamente para evitar loops em erros transientes
    });
  }

  send(type: PacketType, payload?: any) {
    if (this.conn && this.conn.open) {
      const packet: NetworkPacket = { type, payload };
      this.conn.send(packet);
    } else {
      console.warn('Não foi possível enviar, sem conexão');
    }
  }

  destroy() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.conn = null;
    this.peer = null;
  }
}

export const peerService = new PeerService();