export type MessageSender = 'user' | 'aira';

export interface Message {
	sender: MessageSender;
	text: string;
	tps?: string;
	audioData?: string[];
}

export interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	createdAt: Date;
	updatedAt: Date;
}


