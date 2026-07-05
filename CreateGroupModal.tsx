import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Check, Sparkles, AlertCircle } from 'lucide-react';
import { User, Chat } from '../types';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onGroupCreated: (newGroup: Chat) => void;
  isDark: boolean;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  users,
  onGroupCreated,
  isDark
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const groupAvatars = [
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80', // work team
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=150&h=150&q=80', // design brainstorm
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=150&h=150&q=80', // gaming night
    'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=150&h=150&q=80', // studying
  ];

  const handleToggleMember = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!groupName.trim()) {
      setError('Please provide a descriptive Group Name.');
      return;
    }

    if (selectedMemberIds.length === 0) {
      setError('Please select at least one team member.');
      return;
    }

    setIsSuccess(true);
    
    // Simulate short latency
    setTimeout(() => {
      const newGroup: Chat = {
        id: `group_${Date.now()}`,
        isGroup: true,
        name: groupName,
        avatar: avatar,
        description: description || 'No description provided.',
        memberIds: ['self', ...selectedMemberIds],
        adminIds: ['self'], // Self is creator and admin by default
        lastMessageTimestamp: new Date().toISOString(),
        unreadCount: 0
      };

      onGroupCreated(newGroup);
      
      // Reset State
      setGroupName('');
      setDescription('');
      setSelectedMemberIds([]);
      setIsSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`relative z-10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 transition-all duration-300 ${isDark ? 'glass-panel-dark text-white' : 'glass-panel-light text-slate-800'}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" /> Create Workspace Group
              </h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 flex flex-col items-center justify-center text-center"
                >
                  <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
                    <Check className="h-8 w-8 animate-bounce" />
                  </div>
                  <h4 className="text-lg font-bold">Group Channels Synchronized!</h4>
                  <p className="text-xs text-slate-400 mt-2 max-w-xs">
                    Building the decentralized secure channel and propagating credentials to members...
                  </p>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={handleSubmit} className="space-y-4">
                  {/* Name Input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Group Channel Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ⚡ Lightning Launch"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className={`w-full rounded-2xl py-2.5 px-4 text-xs transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="Coordination, updates, and daily stands."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full rounded-2xl py-2.5 px-4 text-xs transition-all border outline-hidden ${isDark ? 'bg-slate-900/60 border-slate-800 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>

                  {/* Avatar Previews */}
                  <div>
                    <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Group Avatar Theme</span>
                    <div className="flex gap-2.5 justify-center">
                      {groupAvatars.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatar(url)}
                          className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition-transform hover:scale-105 cursor-pointer ${avatar === url ? 'border-indigo-500 ring-2 ring-indigo-500/25' : 'border-transparent'}`}
                        >
                          <img src={url} alt="group preset" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Members Selection Checklist */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Add Core Members ({selectedMemberIds.length} selected)
                    </label>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 bg-slate-100/10 dark:bg-slate-900/10">
                      {users.filter(u => u.id !== 'self').map((user) => {
                        const isChecked = selectedMemberIds.includes(user.id);
                        return (
                          <div
                            key={user.id}
                            onClick={() => handleToggleMember(user.id)}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${isChecked ? 'bg-indigo-500/5 text-indigo-500' : 'hover:bg-slate-200/30 dark:hover:bg-slate-800/30'}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-lg object-cover" />
                              <div className="flex flex-col text-left">
                                <span className="font-bold">{user.name}</span>
                                <span className="text-[10px] text-slate-400">@{user.username}</span>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                              {isChecked && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {error && (
                    <p className="text-[11px] text-red-500 text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                      {error}
                    </p>
                  )}

                  {/* Trigger Button */}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-600/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Assemble Group Team <Sparkles className="h-4 w-4" />
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
