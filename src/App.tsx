import React, { useState, useEffect } from 'react';
import { 
  Plus, Video, Users, CheckSquare, Search, MessageSquare, Layers, Sparkles, Filter, RefreshCw, Eye
} from 'lucide-react';
import { Meeting, ReportTemplate } from './types';
import DashboardStats from './components/DashboardStats';
import MeetingCard from './components/MeetingCard';
import MeetingDetails from './components/MeetingDetails';
import NewMeetingModal from './components/NewMeetingModal';
import MeetingMemorySearch from './components/MeetingMemorySearch';

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(true);
  
  // Filter and searches
  const [filter, setFilter] = useState<ReportTemplate | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Fetch all meetings from full-stack backend
  const fetchMeetings = async (selectIdAfterLoad?: string) => {
    try {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const data: Meeting[] = await response.json();
        setMeetings(data);
        
        // Auto select or maintain pointer
        if (selectIdAfterLoad) {
          const matched = data.find(m => m.id === selectIdAfterLoad);
          if (matched) setSelectedMeeting(matched);
        } else if (data.length > 0 && !selectedMeeting) {
          // Default select first item
          setSelectedMeeting(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed pulling meetings list from Express API:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Initial Boot loader
  useEffect(() => {
    fetchMeetings();
  }, []);

  // background polling handler: If any meeting is in 'processing' status, poll server
  useEffect(() => {
    const hasProcessing = meetings.some(m => m.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchMeetings(selectedMeeting?.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [meetings, selectedMeeting]);

  // Handle action item status updates
  const handleToggleAction = async (meetingId: string, actionId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/actions/${actionId}/toggle`, {
        method: 'POST'
      });
      if (response.ok) {
        const updatedMeeting: Meeting = await response.json();
        
        // Refresh items inside meetings arrays
        setMeetings(prev => prev.map(m => m.id === meetingId ? updatedMeeting : m));
        
        // Update detail screen state
        if (selectedMeeting && selectedMeeting.id === meetingId) {
          setSelectedMeeting(updatedMeeting);
        }
      }
    } catch (err) {
      console.error("Action toggle failure:", err);
    }
  };

  // Remove meeting
  const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently erase this meeting intelligence file from server logs?")) {
      return;
    }

    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setMeetings(prev => prev.filter(m => m.id !== id));
        if (selectedMeeting && selectedMeeting.id === id) {
          setSelectedMeeting(null);
        }
      }
    } catch (err) {
      console.error("Delete meeting failed:", err);
    }
  };

  const handleMeetingCreated = (newMeeting: Meeting) => {
    setMeetings(prev => [newMeeting, ...prev]);
    setSelectedMeeting(newMeeting);
  };

  // Direct ID binding for Search matched results
  const handleSelectMatchedMeeting = (id: string) => {
    const matched = meetings.find(m => m.id === id);
    if (matched) {
      setSelectedMeeting(matched);
      // scroll detail pane into view
      const detailPane = document.getElementById('rez_active_workspace_pane');
      detailPane?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // List filtering
  const filteredMeetings = meetings.filter(item => {
    const isCategoryMatch = filter === 'all' || item.template === filter;
    const isSearchMatch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.transcript.some(t => t.text.toLowerCase().includes(searchTerm.toLowerCase()));
    return isCategoryMatch && isSearchMatch;
  });

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1A1A] font-sans selection:bg-[#1A1A1A]/10 selection:text-[#1A1A1A] flex flex-col antialiased">
      
      {/* 1. BRAND NAVIGATION HEADER */}
      <header className="border-b border-[#E5E5E1] bg-[#F8F7F4]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 px-8 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold tracking-tighter text-[#1A1A1A] font-serif">REZ AI</span>
            <div className="h-4 w-px bg-[#E5E5E1]"></div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#71716A]">Universal Intelligence</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Collapse Memory explorer button */}
            <button
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full border transition ${
                isSearchVisible 
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' 
                  : 'bg-white text-[#71716A] hover:text-[#1A1A1A] border-[#E5E5E1] hover:border-[#1A1A1A]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isSearchVisible ? 'Hide Search' : 'Open Search'}</span>
            </button>

            {/* Ingest caller */}
            <button
              id="btn_open_ingest_modal"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-black text-white px-5 py-2 rounded-full text-xs font-medium shadow-sm transition active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Ingest</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. BODY SCROLLER CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-8 flex flex-col min-h-0">
        
        {/* Dynamic Cognitive Intelligence memory section */}
        {isSearchVisible && (
          <MeetingMemorySearch onSelectMeeting={handleSelectMatchedMeeting} />
        )}

        {/* Aggregate metrics dashboards */}
        <DashboardStats meetings={meetings} />

        {/* WORKSPACE AREA: Split Screen */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-[500px]">
          
          {/* LEFT SPLIT: Logs list and tools (Span 4) */}
          <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
            
            {/* Title summary counters */}
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] uppercase font-bold text-[#71716A] tracking-[0.2em] flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#71716A]" />
                <span>Recent Intelligence</span>
              </h3>
              <span className="text-[10px] font-mono bg-white border border-[#E5E5E1] text-[#71716A] px-2 py-0.5 rounded-full font-bold">
                {filteredMeetings.length} item{filteredMeetings.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Filters panel */}
            <div className="bg-white border border-[#E5E5E1] p-5 rounded-2xl shadow-sm space-y-4">
              
              {/* Keyword searches */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#71716A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="inp_feed_title_search"
                  type="text"
                  placeholder="Search titles or transcripts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#F8F7F4] border border-[#E5E5E1] rounded-xl py-2 pl-9.5 pr-4 text-xs text-[#1A1A1A] placeholder-[#71716A]/70 focus:outline-none focus:border-[#71716A]"
                />
              </div>

              {/* Badged category scrolling row */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 invisible-scrollbar">
                <span className="text-[10px] text-[#71716A] font-bold uppercase tracking-wider shrink-0 mr-1">
                  Filter:
                </span>
                
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-colors shrink-0 ${
                    filter === 'all' 
                      ? 'bg-[#1A1A1A] text-white' 
                      : 'bg-[#F8F7F4] border border-[#E5E5E1] text-[#71716A] hover:text-[#1A1A1A] hover:bg-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('scrum')}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-colors shrink-0 ${
                    filter === 'scrum' 
                      ? 'bg-[#1A1A1A] text-white' 
                      : 'bg-[#F8F7F4] border border-[#E5E5E1] text-[#71716A] hover:text-[#1A1A1A] hover:bg-white'
                  }`}
                >
                  Scrum
                </button>
                <button
                  onClick={() => setFilter('client')}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-colors shrink-0 ${
                    filter === 'client' 
                      ? 'bg-[#1A1A1A] text-white' 
                      : 'bg-[#F8F7F4] border border-[#E5E5E1] text-[#71716A] hover:text-[#1A1A1A] hover:bg-white'
                  }`}
                >
                  Client
                </button>
                <button
                  onClick={() => setFilter('interview')}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-colors shrink-0 ${
                    filter === 'interview' 
                      ? 'bg-[#1A1A1A] text-white' 
                      : 'bg-[#F8F7F4] border border-[#E5E5E1] text-[#71716A] hover:text-[#1A1A1A] hover:bg-white'
                  }`}
                >
                  Interview
                </button>
                <button
                  onClick={() => setFilter('sales')}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-colors shrink-0 ${
                    filter === 'sales' 
                      ? 'bg-[#1A1A1A] text-white' 
                      : 'bg-[#F8F7F4] border border-[#E5E5E1] text-[#71716A] hover:text-[#1A1A1A] hover:bg-white'
                  }`}
                >
                  Sales
                </button>
                <button
                  onClick={() => setFilter('investor')}
                  className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-colors shrink-0 ${
                    filter === 'investor' 
                      ? 'bg-[#1A1A1A] text-white' 
                      : 'bg-[#F8F7F4] border border-[#E5E5E1] text-[#71716A] hover:text-[#1A1A1A] hover:bg-white'
                  }`}
                >
                  Investor
                </button>
              </div>

            </div>

            {/* List panel feed */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[calc(100vh-220px)] lg:max-h-none">
              {isLoadingList ? (
                <div className="text-center py-10 bg-white border border-[#E5E5E1] rounded-2xl animate-pulse flex flex-col items-center justify-center shadow-sm">
                  <RefreshCw className="w-5 h-5 text-[#1A1A1A] animate-spin mb-2" />
                  <span className="text-[#1A1A1A] text-xs font-medium">Accessing intelligence repository...</span>
                </div>
              ) : filteredMeetings.length > 0 ? (
                filteredMeetings.map((item) => (
                  <MeetingCard
                    key={item.id}
                    meeting={item}
                    isSelected={selectedMeeting?.id === item.id}
                    onSelect={(meet) => setSelectedMeeting(meet)}
                    onDelete={handleDeleteMeeting}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-white border border-[#E5E5E1] rounded-2xl p-6 shadow-sm">
                  <p className="text-[#1A1A1A] text-xs font-semibold">No recorded intelligence matched</p>
                  <p className="text-[#71716A] text-[10px] mt-1 leading-normal">Refine search text or click "New Ingest" to start simulate long conversations.</p>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT SPLIT: Selected detail workspace content tabs (Span 8) */}
          <div id="rez_active_workspace_pane" className="lg:col-span-8 h-full min-h-[400px]">
            {selectedMeeting ? (
              <MeetingDetails
                meeting={selectedMeeting}
                onToggleAction={handleToggleAction}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-white border border-[#E5E5E1] rounded-3xl min-h-[400px] shadow-sm">
                <Sparkles className="w-8 h-8 text-[#1A1A1A] mb-4 animate-pulse" />
                <h3 className="text-[#1A1A1A] font-serif font-light text-2xl mb-2">REZ AI Terminal</h3>
                <p className="text-[#71716A] text-xs max-w-sm leading-relaxed">No conversation selected. Unpack archived transcripts, executive decisions, and task checklists by choosing a catalog card from the left column.</p>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* 3. MODAL OVERLAY PORTAL */}
      {isModalOpen && (
        <NewMeetingModal
          onClose={() => setIsModalOpen(false)}
          onMeetingCreated={handleMeetingCreated}
        />
      )}

      {/* Global minimal footer */}
      <footer className="border-t border-[#E5E5E1] bg-white px-8 py-5 text-center shrink-0 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-widest text-[#71716A]">
          <div className="flex gap-6">
            <span>Compliance: SOC2 Type II</span>
            <span>Memory Status: Indexed</span>
          </div>
          <div>© 2026 REZ AI SYSTEMS INC.</div>
        </div>
      </footer>

    </div>
  );
}
