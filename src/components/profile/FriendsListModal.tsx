import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../../types';

interface FriendsListModalProps {
    isOpen: boolean;
    onClose: () => void;
    friends: UserProfile[];
    loading: boolean;
}

export default function FriendsListModal({ isOpen, onClose, friends, loading }: FriendsListModalProps) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="text-lg font-bold">Vänner ({friends.length})</h3>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-3 animate-pulse">
                                    <div className="w-12 h-12 bg-muted rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-1/3 bg-muted rounded" />
                                        <div className="h-3 w-1/4 bg-muted rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : friends.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Inga vänner hittades.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {friends.map(friend => (
                                <div
                                    key={friend.uid}
                                    className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-border"
                                    onClick={() => {
                                        onClose();
                                        navigate(`/public-profile/${friend.uid}`);
                                    }}
                                >
                                    <img
                                        src={friend.photoURL || undefined}
                                        className="w-12 h-12 rounded-full object-cover bg-muted border border-border"
                                        alt={friend.displayName}
                                    />
                                    <div>
                                        <p className="font-bold text-foreground text-sm">{friend.displayName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {friend.age > 0 ? `${friend.age} år` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
