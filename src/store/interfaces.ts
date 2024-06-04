export interface User {
  token: string;
  id: number;
  email: string;
  username: string;
  connection_count_sender: number;
  connection_count_acceptor: number;
  gangs: any;
  connections: any;
  input_device_id: string;
  output_device_id: string;
  level?: number;
  created_at?: Date;
  updated_at?: Date;
  error: React.SetStateAction<boolean>;
}

export interface Preferences {
  conversationsOrChat: boolean;
  currentChatId: number;
  currentChatItemId: number;
  currentChatOtherUser: {
    id: number;
    avatar_url: string;
    username: string;
  };
  messages: any;
  lastProfileMenu: number;
  discoverFilters: any;
  currentConvo: any;
}

export interface SignIn {
  email: string;
  password: string;
}

export interface StandardTile {
  id: number;
  name: string;
  price: number;
  image: string;
  level?: number;
  userOwner: number;
  userOwnerName: string;
}
