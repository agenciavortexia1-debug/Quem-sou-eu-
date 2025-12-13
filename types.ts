export enum GameMode {
  MENU = 'MENU',
  HOST = 'HOST',
  JOIN = 'JOIN'
}

export enum AnswerType {
  YES = 'Sim',
  NO = 'Não',
  DONT_KNOW = 'Não sei',
  MAYBE = 'Talvez',
  PROBABLY = 'Provavelmente',
  PROBABLY_NOT = 'Provavelmente não'
}

export interface ChatMessage {
  sender: 'me' | 'opponent' | 'system';
  type: 'text' | 'answer' | 'victory' | 'info';
  content: string;
  timestamp: number;
}

export enum PacketType {
  // Troca de dados inicial
  HANDSHAKE = 'HANDSHAKE', 
  EXCHANGE_CHARACTER = 'EXCHANGE_CHARACTER', // Envia meu personagem para o oponente guardar (e esconder)
  
  // Gameplay
  MESSAGE = 'MESSAGE', // Pergunta ou Chute
  ANSWER = 'ANSWER',   // Resposta (Sim/Não...)
  
  // Fim de jogo
  GAME_WON = 'GAME_WON', // Aviso: "Eu ganhei!"
  RESTART = 'RESTART'
}

export interface NetworkPacket {
  type: PacketType;
  payload?: any;
}