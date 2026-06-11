import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { ArrowLeft, BookCheck, Clock, Layers, Moon, Sun, Search, Filter, Wand2, PartyPopper, Loader2, BrainCircuit, Eye, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { useTheme } from '../../hooks/use-theme';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import FunnyLoader from "../../components/ui/FunnyLoader";

const initialTestPrepTopics = [
  { id: 1, subject: 'Physics', topic: 'Final Exam Review', progress: 75, color: 'blue', sessions: 3, quizzes: 5, gradient: 'from-blue-500 to-blue-400', progressColor: 'bg-blue-500' },
  { id: 2, subject: 'Mathematics', topic: 'Calculus I Mid-term', progress: 40, color: 'purple', sessions: 5, quizzes: 8, gradient: 'from-purple-500 to-purple-400', progressColor: 'bg-purple-500' },
  { id: 3, subject: 'Biology', topic: 'Genetics Chapter Test', progress: 90, color: 'sky', sessions: 1, quizzes: 2, gradient: 'from-sky-500 to-sky-400', progressColor: 'bg-sky-500' },
  { id: 4, subject: 'History', topic: 'Ancient Civilizations', progress: 20, color: 'amber', sessions: 10, quizzes: 15, gradient: 'from-amber-500 to-amber-400', progressColor: 'bg-amber-500' },
];

const subjectColors = {
    Physics: "bg-blue-500/20 text-blue-600 dark:text-blue-300",
    Mathematics: "bg-purple-500/20 text-purple-600 dark:text-purple-300",
    Biology: "bg-sky-500/20 text-sky-600 dark:text-sky-300",
    History: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
    "Computer Science": "bg-pink-500/20 text-pink-600 dark:text-pink-300",
};

const colorMap = {
  blue: { gradient: 'from-blue-500 to-blue-400', progressColor: 'bg-blue-500' },
  purple: { gradient: 'from-purple-500 to-purple-400', progressColor: 'bg-purple-500' },
  sky: { gradient: 'from-sky-500 to-sky-400', progressColor: 'bg-sky-500' },
  amber: { gradient: 'from-amber-500 to-amber-400', progressColor: 'bg-amber-500' },
  pink: { gradient: 'from-pink-500 to-pink-400', progressColor: 'bg-pink-500' },
  green: { gradient: 'from-green-500 to-green-400', progressColor: 'bg-green-500' },
  yellow: { gradient: 'from-yellow-500 to-yellow-400', progressColor: 'bg-yellow-500' },
};
const subjectColorKeys = Object.keys(subjectColors);

const TestPrepDashboard = () => {
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [prepPlans, setPrepPlans] = useState(initialTestPrepTopics);
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanTopic, setNewPlanTopic] = useState('');
  const [newPlanSubject, setNewPlanSubject] = useState('');

  const [viewingPlan, setViewingPlan] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const filteredPlans = useMemo(() => {
    return prepPlans
        .filter(plan => plan.topic.toLowerCase().includes(searchTerm.toLowerCase()))
        .filter(plan => subjectFilter === 'all' || plan.subject === subjectFilter);
  }, [prepPlans, searchTerm, subjectFilter]);

  const subjects = useMemo(() => ['all', ...Array.from(new Set(prepPlans.map(p => p.subject)))], [prepPlans]);

  const handleCreatePlan = () => {
    if (!newPlanTopic || !newPlanSubject) return;
    setIsCreating(true);
    setTimeout(() => {
        const newPlanId = prepPlans.length > 0 ? Math.max(...prepPlans.map(p => p.id)) + 1 : 1;
        const colorKeys = Object.keys(colorMap);
  const randomColorKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
  const randomColor = colorMap[randomColorKey];
  
  const newPlan = {
      id: newPlanId,
      topic: newPlanTopic,
      subject: newPlanSubject,
      progress: 0,
      sessions: Math.floor(Math.random() * 5) + 3,
      quizzes: Math.floor(Math.random() * 8) + 2,
      color: randomColorKey,
      gradient: randomColor.gradient,
      progressColor: randomColor.progressColor,
  };
        setPrepPlans(prev => [newPlan, ...prev]);
        setIsCreating(false);
        setCreateModalOpen(false);
        setNewPlanTopic('');
        setNewPlanSubject('');
    }, 2500);
  };

  const handleViewPlan = (plan) => {
    setViewingPlan(plan);
    setIsLoadingDetails(true);
    setTimeout(() => {
        setIsLoadingDetails(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-900 dark:text-white p-4 sm:p-8 font-sans overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-7xl mx-auto"
      >
        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <Link href="/ai-tutor">
                <Button variant="outline" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Studio
                </Button>
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500">
                <BookCheck />
                Test Preparation
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
                <div className="relative">
                    <Input placeholder="Search plans..." className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 pl-10 w-40 sm:w-auto" onChange={(e) => setSearchTerm(e.target.value)} />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <Filter className="mr-2 h-4 w-4" />
                            Subject
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                        <DropdownMenuRadioGroup value={subjectFilter} onValueChange={setSubjectFilter}>
                            {subjects.map(s => <DropdownMenuRadioItem key={s} value={s}>{s === 'all' ? 'All Subjects' : s}</DropdownMenuRadioItem>)}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 transition-all duration-300 transform hover:scale-105" onClick={() => setCreateModalOpen(true)}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    New Plan
                </Button>
            </div>
        </header>

        <AnimatePresence>
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } }}}
                initial="hidden"
                animate="show"
            >
              {filteredPlans.map((item) => (
                <motion.div
                    key={item.id}
                    variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    layout
                    whileHover={{ scale: 1.03, y: -5, transition: { type: 'spring', stiffness: 300, damping: 15 } }}
                >
                  <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-purple-500 transition-colors h-full flex flex-col group overflow-hidden">
                    <div className={`h-1.5 bg-gradient-to-r ${item.gradient}`}></div>
                    <CardContent className="p-6 flex-grow flex flex-col">
                        <span className={`text-xs px-2 py-1 rounded-full ${subjectColors[item.subject] || 'bg-gray-500/20 text-gray-600 dark:text-gray-300'} self-start`}>{item.subject}</span>
                        <h3 className="text-2xl font-bold my-2 text-slate-800 dark:text-slate-100 group-hover:text-purple-500 transition-colors">{item.topic}</h3>
                        
                        <div className="my-4">
                            <div className="flex justify-between items-center mb-1 text-slate-500 dark:text-slate-400">
                            <span className="text-xs font-medium">Progress</span>
                            <span className="text-sm font-bold">{item.progress}%</span>
                            </div>
                            <Progress value={item.progress} className="h-2" indicatorClassName={item.progressColor} />
                        </div>

                        <div className="flex flex-col gap-2 text-slate-500 dark:text-slate-400 text-sm mb-6 flex-grow">
                            <div className="flex items-center gap-2"><Clock className="h-4 w-4"/> {item.sessions} sessions remaining</div>
                            <div className="flex items-center gap-2"><Layers className="h-4 w-4"/> {item.quizzes} practice quizzes</div>
                        </div>

                        <Button onClick={() => handleViewPlan(item)} className="w-full mt-auto bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-purple-500 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white group-hover:bg-purple-500 dark:group-hover:bg-purple-600 transition-all duration-300 transform hover:scale-105">
                            <Eye className="mr-2 h-4 w-4"/>
                            Continue Prep
                        </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
        </AnimatePresence>
         {filteredPlans.length === 0 && (
            <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center col-span-full py-20"
            >
                <BookCheck className="mx-auto h-24 w-24 text-slate-400 dark:text-slate-600" />
                <h2 className="mt-6 text-2xl font-bold text-slate-600 dark:text-slate-400">No Prep Plans Found!</h2>
                <p className="mt-2 text-slate-500">Try adjusting your search or filters, or create a new plan!</p>
            </motion.div>
        )}
      </motion.div>
      
      <AnimatePresence>
        {isCreateModalOpen && (
            <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
                <DialogContent className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                        {isCreating ? (
                            <div className="h-64 flex items-center justify-center">
                                <FunnyLoader />
                            </div>
                        ) : (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-2xl">
                                        <Sparkles className="text-purple-400"/>
                                        Create a New Prep Plan
                                    </DialogTitle>
                                    <DialogDescription>
                                        What subject do you want to master next?
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <label htmlFor="topic" className="text-right">Topic</label>
                                        <Input id="topic" value={newPlanTopic} onChange={(e) => setNewPlanTopic(e.target.value)} placeholder="e.g., Final Exam Review" className="col-span-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <label htmlFor="subject" className="text-right">Subject</label>
                                        <Input id="subject" value={newPlanSubject} onChange={(e) => setNewPlanSubject(e.target.value)} placeholder="e.g., Physics" className="col-span-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" onClick={handleCreatePlan} className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600">
                                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PartyPopper className="mr-2 h-4 w-4"/>}
                                        Start Plan
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </motion.div>
                </DialogContent>
            </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingPlan && (
            <Dialog open={!!viewingPlan} onOpenChange={() => setViewingPlan(null)}>
                <DialogContent className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white max-w-2xl">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                        {isLoadingDetails ? (
                            <div className="h-80 flex items-center justify-center">
                                <FunnyLoader />
                            </div>
                        ) : (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-3 text-2xl bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500">
                                        <BookCheck className="h-8 w-8 text-purple-500"/>
                                        {viewingPlan.topic}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Here's your study plan. Let's get to it!
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="my-6 space-y-4">
                                    <p><strong>Subject:</strong> {viewingPlan.subject}</p>
                                    <p><strong>Current Progress:</strong> {viewingPlan.progress}%</p>
                                    <p>Your plan includes <strong>{viewingPlan.sessions} more study sessions</strong> and <strong>{viewingPlan.quizzes} practice quizzes</strong>.</p>
                                    <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                        <h4 className="font-bold mb-2 text-lg text-slate-700 dark:text-slate-300">Recommended Next Steps:</h4>
                                        <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
                                            <li>Review Chapter 1: Core Concepts of {viewingPlan.subject}</li>
                                            <li>Take a practice quiz on {viewingPlan.topic}</li>
                                            <li>Watch a summary video on advanced topics</li>
                                            <li>Challenge yourself with flashcards</li>
                                        </ul>
                                    </div>
                                </div>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button onClick={() => setViewingPlan(null)} variant="outline" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">Close</Button>
                                    <Button onClick={() => setLocation(`/studio/quiz/${viewingPlan.id}`)} className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 transition-all duration-300 transform hover:scale-105">
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Start a Quiz
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

export default TestPrepDashboard;
