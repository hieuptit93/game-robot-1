import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient.js';

function SurveyModal({ isOpen, onClose, onPlayAgain, gameSessionId, currentGameId, userId, age, urlParams }) {
    const [step, setStep] = useState(1);
    const [likeAnswer, setLikeAnswer] = useState(null); // 😊 | 😐 | 😞
    const [difficultyAnswer, setDifficultyAnswer] = useState(null); // easy | normal | hard
    const [comment, setComment] = useState('');
    const [wantsReplay, setWantsReplay] = useState(null); // yes | no
    const [isLoadingGames, setIsLoadingGames] = useState(false);
    const [shuffledGames, setShuffledGames] = useState([]);
    const [hasLoadedGames, setHasLoadedGames] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setLikeAnswer(null);
            setDifficultyAnswer(null);
            setComment('');
            setWantsReplay(null);
            setHasLoadedGames(false);
        }
    }, [isOpen]);

    // Fetch games once when modal opens (hooks must not be conditional)
    useEffect(() => {
        const fetchGames = async () => {
            try {
                setIsLoadingGames(true);
                const { data, error } = await supabase
                    .from('games')
                    .select('id, title, key, image, href, is_active')
                    .eq('is_active', true)
                    .order('id');

                if (error) throw error;

                const fetched = (data || []).map((g) => ({
                    id: g.id,
                    title: g.title,
                    key: g.key,
                    image: g.image,
                    href: g.href,
                }));

                const numericCurrentId = Number.isFinite(Number(currentGameId)) ? Number(currentGameId) : currentGameId;
                const filtered = fetched.filter((g) => (numericCurrentId != null ? g.id !== numericCurrentId : true));

                const shuffled = [...filtered];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                setShuffledGames(shuffled);
            } catch (err) {
                console.error('Error fetching games:', err);
                setShuffledGames([]);
            } finally {
                setIsLoadingGames(false);
            }
        };

        if (isOpen && !hasLoadedGames) {
            fetchGames();
            setHasLoadedGames(true);
        }
    }, [isOpen, hasLoadedGames, currentGameId]);

    if (!isOpen) return null;

    const handleNextFromStep1 = async (value) => {
        setLikeAnswer(value);
        try {
            const mapping = {
                happy: 'rat-thich',
                neutral: 'binh-thuong',
                sad: 'khong-thich'
            };
            if (gameSessionId) {
                await supabase
                    .from('game_sessions')
                    .update({ level_of_liking: mapping[value] })
                    .eq('id', gameSessionId);
            }
        } catch (e) {
            console.error('Update level_of_liking failed', e);
        }
        setStep(2);
    };

    const handleNextFromStep2 = async (value) => {
        setDifficultyAnswer(value);
        try {
            const mapping = {
                easy: 'de',
                normal: 'binh-thuong',
                hard: 'kho'
            };
            if (gameSessionId) {
                await supabase
                    .from('game_sessions')
                    .update({ difficuly: mapping[value] })
                    .eq('id', gameSessionId);
            }
        } catch (e) {
            console.error('Update difficuly failed', e);
        }
        setStep(3);
    };

    const handleSubmitComment = async () => {
        try {
            if (gameSessionId) {
                await supabase
                    .from('game_sessions')
                    .update({ comment })
                    .eq('id', gameSessionId);
            }
        } catch (e) {
            console.error('Update comment failed', e);
        }
        setStep(4);
    };

    const handleReplayChoice = async (value) => {
        setWantsReplay(value);
        if (value === 'yes') {
            try {
                if (gameSessionId) {
                    // Read current number_of_replays then increment
                    const { data, error } = await supabase
                        .from('game_sessions')
                        .select('number_of_replays')
                        .eq('id', gameSessionId)
                        .single();
                    if (!error) {
                        const current = Number.isFinite(Number(data?.number_of_replays)) ? Number(data.number_of_replays) : 0;
                        await supabase
                            .from('game_sessions')
                            .update({ number_of_replays: current + 1 })
                            .eq('id', gameSessionId);
                    }
                }
                // mark survey completed
                await supabase
                    .from('game_sessions')
                    .update({ survey_completed: true })
                    .eq('id', gameSessionId);
            } catch (e) {
                console.error('Increment number_of_replays failed', e);
            }
            onPlayAgain?.();
        } else {
            // Stay in modal and show suggestions
            setStep(5);
            try {
                if (gameSessionId) {
                    await supabase
                        .from('game_sessions')
                        .update({ survey_completed: true })
                        .eq('id', gameSessionId);
                }
            } catch (e) {
                console.error('Mark survey completed failed', e);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
            {/* Backdrop (no close on click until finished) */}
            <div className="absolute inset-0 bg-black/80" />

            {/* Modal */}
            <div className="relative z-50 w-[92%] max-w-xl mx-auto bg-gray-900 border border-cyan-700 rounded-lg shadow-2xl p-4 md:p-6 text-cyan-100">
                <h3 className="text-xl md:text-2xl font-mono text-cyan-300 mb-4 md:mb-6 text-center">KHẢO SÁT NHANH</h3>

                {/* Step indicator */}
                <div className="flex items-center justify-center mb-4 md:mb-6 space-x-2">
                    {[1,2,3,4].map((s) => (
                        <div key={s} className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${step === s ? 'bg-cyan-400' : 'bg-gray-700'}`} />
                    ))}
                </div>

                {/* Step 1: Like */}
                {step === 1 && (
                    <div>
                        <p className="text-center text-lg md:text-xl font-mono text-yellow-300 mb-4">Bạn có thích trò chơi này không?</p>
                        <div className="flex justify-center space-x-3 md:space-x-6">
                            <button onClick={() => handleNextFromStep1('happy')} className={`px-4 py-3 md:px-6 md:py-4 rounded-lg border ${likeAnswer === 'happy' ? 'border-cyan-400 bg-cyan-900/30' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono text-2xl`} aria-label="Rất thích">😊</button>
                            <button onClick={() => handleNextFromStep1('neutral')} className={`px-4 py-3 md:px-6 md:py-4 rounded-lg border ${likeAnswer === 'neutral' ? 'border-cyan-400 bg-cyan-900/30' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono text-2xl`} aria-label="Bình thường">😐</button>
                            <button onClick={() => handleNextFromStep1('sad')} className={`px-4 py-3 md:px-6 md:py-4 rounded-lg border ${likeAnswer === 'sad' ? 'border-cyan-400 bg-cyan-900/30' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono text-2xl`} aria-label="Không thích">😞</button>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-4">(Bắt buộc)</p>
                    </div>
                )}

                {/* Step 2: Difficulty */}
                {step === 2 && (
                    <div>
                        <p className="text-center text-lg md:text-xl font-mono text-yellow-300 mb-4">Trò chơi này dễ hay khó?</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button onClick={() => handleNextFromStep2('easy')} className={`px-4 py-3 rounded-lg border ${difficultyAnswer === 'easy' ? 'border-cyan-400 bg-cyan-900/30' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono`}>Dễ</button>
                            <button onClick={() => handleNextFromStep2('normal')} className={`px-4 py-3 rounded-lg border ${difficultyAnswer === 'normal' ? 'border-cyan-400 bg-cyan-900/30' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono`}>Bình thường</button>
                            <button onClick={() => handleNextFromStep2('hard')} className={`px-4 py-3 rounded-lg border ${difficultyAnswer === 'hard' ? 'border-cyan-400 bg-cyan-900/30' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono`}>Khó</button>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-4">(Bắt buộc)</p>
                    </div>
                )}

                {/* Step 3: Optional comment */}
                {step === 3 && (
                    <div>
                        <p className="text-center text-lg md:text-xl font-mono text-yellow-300 mb-3">Bạn có góp ý gì cho trò chơi này không?</p>
                        <textarea
                            className="w-full bg-gray-800 border border-cyan-700 focus:border-cyan-400 outline-none rounded-md p-3 text-sm md:text-base placeholder-gray-500"
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Nhập bình luận ngắn (tùy chọn)"
                        />
                        <div className="mt-4 flex justify-end">
                            <button onClick={handleSubmitComment} className="px-5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-md font-mono">Tiếp tục</button>
                        </div>
                    </div>
                )}

                {/* Step 4: Replay? */}
                {step === 4 && (
                    <div>
                        <p className="text-center text-lg md:text-xl font-mono text-yellow-300 mb-4">Bạn có muốn chơi lại không?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleReplayChoice('yes')} className={`px-4 py-3 rounded-lg border ${wantsReplay === 'yes' ? 'border-green-400 bg-green-900/20' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono`}>Có</button>
                            <button onClick={() => handleReplayChoice('no')} className={`px-4 py-3 rounded-lg border ${wantsReplay === 'no' ? 'border-red-400 bg-red-900/20' : 'border-cyan-700 bg-gray-800'} hover:bg-gray-700 transition font-mono`}>Không</button>
                        </div>
                    </div>
                )}

                {/* Step 5: Suggestions */}
                {step === 5 && (
                    <div>
                        <p className="text-center text-lg md:text-xl font-mono text-yellow-300 mb-4">Gợi ý trò chơi tiếp theo</p>
                        {isLoadingGames ? (
                            <div className="text-center text-cyan-300 font-mono">Đang tải gợi ý...</div>
                        ) : (
                            <div className="space-y-3">
                                {(shuffledGames).map((g) => {
                                    const baseHref = g.href || '#';
                                    const initial = { ...(urlParams || {}) };
                                    const params = {
                                        ...initial,
                                        user_id: userId ?? initial.user_id,
                                        age: age ?? initial.age,
                                        game_id: g.id, // chuyển sang game được click
                                    };
                                    const query = new URLSearchParams(
                                        Object.fromEntries(
                                            Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '' )
                                        )
                                    ).toString();
                                    const fullHref = query ? `${baseHref}?${query}` : baseHref;

                                    return (
                                    <a key={g.id} href={fullHref}
                                       className="block w-full px-4 py-3 rounded-lg border border-cyan-700 bg-gray-800 hover:bg-gray-700 transition text-left font-mono">
                                        <div className="flex items-center space-x-3">
                                            {g.image ? (
                                                <img src={g.image} alt={g.title} className="w-10 h-10 object-cover rounded" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">🎮</div>
                                            )}
                                            <div className="flex-1">
                                                <div className="text-cyan-200">{g.title || g.key}</div>
                                                {g.key && <div className="text-xs text-gray-400">{g.key}</div>}
                                            </div>
                                        </div>
                                    </a>
                                    );
                                })}
                                {shuffledGames.length === 0 && (
                                    <div className="text-center text-sm text-gray-400">Chưa có gợi ý phù hợp</div>
                                )}
                            </div>
                        )}
                        <div className="mt-5 flex justify-end">
                            <button onClick={onClose} className="px-5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-md font-mono">Đóng</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SurveyModal;


