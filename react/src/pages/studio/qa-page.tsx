import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { ArrowLeft, HelpCircle, ThumbsUp, ThumbsDown, Moon, Sun, Wand2, PartyPopper, Loader2, Search, Lightbulb, MessageSquarePlus } from 'lucide-react';
import { Link } from 'wouter';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardFooter } from '../../components/ui/card';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { useTheme } from '../../hooks/use-theme';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import FunnyLoader from "../../components/ui/FunnyLoader";

const initialQaItems = [
  {
    id: 1,
    question: "What is the difference between velocity and speed?",
    answer: "Speed is a scalar quantity that refers to 'how fast an object is moving.' Velocity is a vector quantity that refers to 'the rate at which an object changes its position.'",
    author: "Physics Bot",
    avatar: "⚛️",
    likes: 12,
    dislikes: 1,
  },
  {
    id: 2,
    question: "Can you explain the concept of recursion in programming?",
    answer: "Recursion is a method of solving a problem where the solution depends on solutions to smaller instances of the same problem. A function that calls itself is a recursive function.",
    author: "CS Bot",
    avatar: "💻",
    likes: 25,
    dislikes: 0,
  },
];

const QAPage = () => {
    const { theme, setTheme } = useTheme();
    const [qaItems, setQaItems] = useState(initialQaItems);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAskModalOpen, setAskModalOpen] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');

    const filteredItems = useMemo(() => {
        return qaItems.filter(item => 
            item.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.answer.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [qaItems, searchTerm]);

    const handleAskQuestion = () => {
        if (!newQuestion) return;
        setIsPosting(true);
        setTimeout(() => {
            const newId = qaItems.length > 0 ? Math.max(...qaItems.map(q => q.id)) + 1 : 1;
            
            let aiAnswer = "That's a fantastic question! While I gather the most accurate information from our knowledge base, a key point to consider is how this topic relates to broader scientific or philosophical principles.";
            const lowerCaseQuestion = newQuestion.toLowerCase();

            if(lowerCaseQuestion.includes('react')) {
                aiAnswer = "Regarding React, it's a powerful library for building user interfaces. A core concept is its component-based architecture, which allows for reusable and manageable UI pieces. The virtual DOM is another key feature for performance optimization.";
            } else if (lowerCaseQuestion.includes('python')) {
                aiAnswer = "Python is known for its simplicity and readability. When you ask about it, it's often related to its vast libraries like NumPy for science, Django for web dev, or PyTorch for AI. It's a versatile language!";
            } else if (lowerCaseQuestion.includes('life')) {
                aiAnswer = "The meaning of life is a profound philosophical question that has been debated for centuries! From a biological perspective, it's about survival and reproduction. Many philosophical views suggest it's about finding happiness, purpose, or connection.";
            }

            const newQa = {
                id: newId,
                question: newQuestion,
                answer: aiAnswer,
                author: "AI Assistant",
                avatar: "🤖",
                likes: 0,
                dislikes: 0,
            };
            setQaItems(prev => [newQa, ...prev]);
            setIsPosting(false);
            setAskModalOpen(false);
            setNewQuestion('');
        }, 2500);
    };

    const handleVote = (id, type) => {
        setQaItems(items => items.map(item => {
            if (item.id === id) {
                if (type === 'like') return { ...item, likes: item.likes + 1 };
                if (type === 'dislike') return { ...item, dislikes: item.dislikes + 1 };
            }
            return item;
        }));
    };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-white p-4 sm:p-8 font-sans overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <Link href="/ai-tutor">
                <Button variant="outline" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Studio
                </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500 order-first sm:order-none w-full sm:w-auto text-center justify-center">
                <HelpCircle />
                Q&A Forum
            </h1>
            <div className="flex items-center gap-2">
                 <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 transition-all duration-300 transform hover:scale-105" onClick={() => setAskModalOpen(true)}>
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Ask Question</span>
                </Button>
            </div>
        </header>

        <div className="relative mb-8">
            <Input placeholder="Search for a question or answer..." className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-lg p-6 rounded-xl pl-12" onChange={(e) => setSearchTerm(e.target.value)} />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 dark:text-slate-500" />
        </div>

        <AnimatePresence>
            <motion.div 
                className="space-y-6"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } }}}
                initial="hidden"
                animate="show"
            >
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  layout
                >
                  <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-purple-500/50 transition-colors">
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-purple-300">{item.question}</h3>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{item.answer}</p>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center p-4 pt-0 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-purple-400 text-sm">{item.avatar}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold">{item.author}</span>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-4">
                        <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:text-green-500 hover:bg-green-500/10" onClick={() => handleVote(item.id, 'like')}>
                          <ThumbsUp className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="text-xs sm:text-sm font-bold">{item.likes}</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleVote(item.id, 'dislike')}>
                          <ThumbsDown className="h-4 w-4 sm:h-5 sm:w-5" />
                           <span className="text-xs sm:text-sm font-bold">{item.dislikes}</span>
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
        </AnimatePresence>

        {filteredItems.length === 0 && (
            <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center col-span-full py-20"
            >
                <HelpCircle className="mx-auto h-24 w-24 text-slate-400 dark:text-slate-600" />
                <h2 className="mt-6 text-2xl font-bold text-slate-600 dark:text-slate-400">No Questions Found!</h2>
                <p className="mt-2 text-slate-500">Be the first to ask a question!</p>
            </motion.div>
        )}
      </motion.div>

       <AnimatePresence>
        {isAskModalOpen && (
            <Dialog open={isAskModalOpen} onOpenChange={setAskModalOpen}>
                <DialogContent className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                        {isPosting ? (
                            <div className="h-64 flex items-center justify-center">
                                <FunnyLoader />
                            </div>
                        ) : (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-2xl">
                                        <Wand2 className="text-purple-400"/>
                                        Ask a New Question
                                    </DialogTitle>
                                    <DialogDescription>
                                       What's on your mind? Our community of bots and learners are here to help.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Textarea 
                                        value={newQuestion}
                                        onChange={(e) => setNewQuestion(e.target.value)}
                                        placeholder="Type your question here..." 
                                        className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 min-h-[120px] text-base" 
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" onClick={handleAskQuestion} className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600">
                                        {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PartyPopper className="mr-2 h-4 w-4"/>}
                                        Post Question
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </motion.div>
                </DialogContent>
            </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QAPage;
