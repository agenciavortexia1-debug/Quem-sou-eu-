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
  type: 'text' | 'answer' | 'guess';
  content: string;
  answerType?: AnswerType;
  timestamp: number;
}

export enum PacketType {
  HANDSHAKE = 'HANDSHAKE',
  SETUP_CHARACTER = 'SETUP_CHARACTER',
  QUESTION = 'QUESTION',
  ANSWER = 'ANSWER',
  GUESS = 'GUESS',
  GUESS_RESULT = 'GUESS_RESULT',
  RESTART = 'RESTART'
}

export interface NetworkPacket {
  type: PacketType;
  payload?: any;
}
