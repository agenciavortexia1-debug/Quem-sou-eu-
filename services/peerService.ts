import { Peer, DataConnection } from "peerjs";
import { NetworkPacket, PacketType } from "../types";

export class PeerService {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  onDataCallback: ((packet: NetworkPacket) => void) | null = null;
  onConnectCallback: (() => void) | null = null;
  onCloseCallback: (() => void) | null = null;

  // Modificado para aceitar um ID fixo opcional
  async initialize(customId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Se customId for passado, o PeerJS tentará usar esse ID na rede
      const peer = customId ? new Peer(customId) : new Peer();
      
      peer.on('open', (id) => {
        this.peer = peer;
        console.log('My Peer ID:', id);
        
        // Listen for incoming connections
        peer.on('connection', (conn) => {
          this.handleConnection(conn);
        });
        
        resolve(id);
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        // Se o ID já estiver em uso (ex: reconexão rápida), tentamos reconectar ou falhamos
        if (err.type === 'unavailable-id') {
           // Opcional: Lógica de retry poderia ser implementada aqui, 
           // mas para este caso simples, vamos deixar o erro subir.
        }
        reject(err);
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
    // Se já temos uma conexão ativa, talvez queiramos fechar a nova ou a antiga.
    // Para simplificar, vamos assumir que a nova substitui se a antiga estiver ruim,
    // ou ignorar se já estivermos bem.
    if (this.conn && this.conn.open) {
        return; 
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
      if (this.onCloseCallback) this.onCloseCallback();
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