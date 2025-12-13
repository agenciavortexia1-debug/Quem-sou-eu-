import { Peer, DataConnection } from "peerjs";
import { NetworkPacket, PacketType } from "../types";

export class PeerService {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  onDataCallback: ((packet: NetworkPacket) => void) | null = null;
  onConnectCallback: (() => void) | null = null;
  onCloseCallback: (() => void) | null = null;

  async initialize(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a random ID (PeerJS default)
      const peer = new Peer();
      
      peer.on('open', (id) => {
        this.peer = peer;
        console.log('My Peer ID:', id);
        
        // Listen for incoming connections (Host logic)
        peer.on('connection', (conn) => {
          this.handleConnection(conn);
        });
        
        resolve(id);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  connect(remotePeerId: string) {
    if (!this.peer) return;
    const conn = this.peer.connect(remotePeerId);
    this.handleConnection(conn);
  }

  private handleConnection(conn: DataConnection) {
    this.conn = conn;

    conn.on('open', () => {
      console.log('Connected to:', conn.peer);
      if (this.onConnectCallback) this.onConnectCallback();
    });

    conn.on('data', (data) => {
      if (this.onDataCallback) {
        this.onDataCallback(data as NetworkPacket);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed');
      this.conn = null;
      if (this.onCloseCallback) this.onCloseCallback();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      if (this.onCloseCallback) this.onCloseCallback();
    });
  }

  send(type: PacketType, payload?: any) {
    if (this.conn && this.conn.open) {
      const packet: NetworkPacket = { type, payload };
      this.conn.send(packet);
    } else {
      console.warn('Cannot send, connection not open');
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