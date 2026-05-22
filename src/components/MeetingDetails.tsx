import { useState } from 'react';
import { Meeting, ActionItem } from '../types';
import { 
  FileText, MessageSquare, CheckSquare, Send, Check, Copy, 
  Download, Sparkles, AlertTriangle, Calendar, Clock, Speaker, Search, User
} from 'lucide-react';

interface MeetingDetailsProps {
  meeting: Meeting;
  onToggleAction: (meetingId: string, actionId: string) => Promise<void>;
}

export default function MeetingDetails({ meeting, onToggleAction }: MeetingDetailsProps) {
  const [activeTab, setActiveTab] = useState<'report' | 'transcript' | 'actions' | 'followup'>('report');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('all');
  const [copies, setCopies] = useState<Record<string, boolean>>({});

  if (!meeting) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-white border border-[#E5E5E1] rounded-3xl min-h-[400px] shadow-sm">
        <Sparkles className="w-8 h-8 text-[#1A1A1A] mb-4 animate-pulse" />
        <h3 className="text-[#1A1A1A] font-serif font-light text-2xl mb-2">REZ AI Terminal</h3>
        <p className="text-[#71716A] text-xs max-w-sm leading-relaxed">No conversation selected. Unpack archived transcripts, executive decisions, and task checklists by choosing a catalog card from the left column.</p>
      </div>
    );
  }

  // Handle document exports
  const triggerDownloadMarkdown = () => {
    const reportText = `
# ${meeting.title}
Date: ${new Date(meeting.date).toLocaleString()}
Platform: ${meeting.platform}
Category: ${meeting.template}

## Executive Summary
${meeting.report?.summary || ''}

## Key Decisions
${(meeting.report?.decisions || []).map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Documented Risks & Rollbacks
${(meeting.report?.risks || []).map((r, i) => `- [!] ${r}`).join('\n')}

## Upcoming Actions
${meeting.actionItems.map(a => `- [${a.status === 'completed' ? 'x' : ' '}] ${a.owner}: ${a.task} (${a.deadline})`).join('\n')}
    `;
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${meeting.title.replace(/\s+/g, '_')}_intelligence.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toast status copiers
  const executeClipboardCopy = (key: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopies(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopies(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const getSpeakerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const speakColours: Record<string, string> = {
    "John": "bg-[#F8F7F4] text-[#1A1A1A] border border-[#E5E5E1]",
    "Sarah": "bg-[#F8F7F4] text-[#1A1A1A] border border-[#E5E5E1]",
    "Vinitha": "bg-[#F8F7F4] text-[#1A1A1A] border border-[#E5E5E1]",
    "Liam": "bg-[#F8F7F4] text-[#1A1A1A] border border-[#E5E5E1]",
    "Robert": "bg-[#F8F7F4] text-[#1A1A1A] border border-[#E5E5E1]",
    "Sarah Chen": "bg-[#F8F7F4] text-[#1A1A1A] border border-[#E5E5E1]",
  };

  const getSpeakerColor = (name: string) => {
    return speakColours[name] || "bg-[#F8F7F4] text-[#1A1A1A] border border-[#E5E5E1]";
  };

  const formatSecs = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Filter dialogs
  const dialogueChunks = meeting.transcript || [];
  const uniqSpeakers = Array.from(new Set(dialogueChunks.map(c => c.speaker)));

  const filteredDialogue = dialogueChunks.filter(chunk => {
    const speakOk = selectedSpeaker === 'all' || chunk.speaker === selectedSpeaker;
    const searchOk = chunk.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                     chunk.speaker.toLowerCase().includes(searchTerm.toLowerCase());
    return speakOk && searchOk;
  });

  // Simple Markdown Parser for executive descriptions
  function renderMarkdown(markdown: string) {
    if (!markdown) return null;
    const lines = markdown.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-[#1A1A1A] font-serif font-bold text-sm uppercase tracking-wider mb-2 mt-4 first:mt-0">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-[#1A1A1A] font-serif font-bold text-lg mb-3 mt-5 first:mt-0">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-[#1A1A1A] font-serif font-extrabold text-xl mb-4 mt-6 first:mt-0">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="text-[#1A1A1A] text-sm list-disc ml-5 mb-2 leading-relaxed">
            {formatInlineText(line.substring(2))}
          </li>
        );
      }
      if (!line.trim()) return <div key={idx} className="h-2" />;
      return <p key={idx} className="text-[#1A1A1A] text-sm leading-relaxed mb-3">{formatInlineText(line)}</p>;
    });
  }

  function formatInlineText(text: string) {
    const boldPattern = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="text-[#1A1A1A] font-bold">{match[1]}</strong>);
      lastIndex = boldPattern.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }

  return (
    <div className="bg-white border border-[#E5E5E1] rounded-2xl overflow-hidden shadow-sm flex flex-col h-full h-[calc(100vh-180px)]">
      
      {/* Header Profile */}
      <div className="p-6 bg-white border-b border-[#E5E5E1] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] bg-[#F8F7F4] border border-[#E5E5E1] text-[#71716A] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                {meeting.template}
              </span>
              <span className="text-[#E5E5E1] font-mono text-[10px]">•</span>
              <span className="text-[11px] text-[#71716A] flex items-center gap-1 font-medium bg-[#F8F7F4] px-2 py-0.5 rounded border border-[#E5E5E1]">
                <Calendar className="w-3 h-3 text-[#71716A]" />
                {new Date(meeting.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </span>
              <span className="text-[11px] text-[#71716A] flex items-center gap-1 font-mono bg-[#F8F7F4] px-2 py-0.5 rounded border border-[#E5E5E1]">
                <Clock className="w-3 h-3 text-[#71716A]" />
                {formatSecs(meeting.duration)}
              </span>
            </div>
            <h2 className="text-xl font-serif font-bold text-[#1A1A1A] tracking-tight leading-snug">{meeting.title}</h2>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn_export_markdown"
              onClick={triggerDownloadMarkdown}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-black text-white rounded-full transition-all duration-200"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span>Export .MD</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 mt-6 bg-[#F8F7F4] p-1 rounded-full border border-[#E5E5E1] w-fit">
          <button
            id="tab_opt_report"
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeTab === 'report' 
                ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#E5E5E1]' 
                : 'text-[#71716A] hover:text-[#1A1A1A] hover:bg-white/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Structured Intelligence</span>
          </button>
          <button
            id="tab_opt_transcript"
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeTab === 'transcript' 
                ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#E5E5E1]' 
                : 'text-[#71716A] hover:text-[#1A1A1A] hover:bg-white/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Dialogue Transcript</span>
          </button>
          <button
            id="tab_opt_actions"
            onClick={() => setActiveTab('actions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 relative ${
              activeTab === 'actions' 
                ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#E5E5E1]' 
                : 'text-[#71716A] hover:text-[#1A1A1A] hover:bg-white/50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Action Items</span>
            {meeting.actionItems.filter(a => a.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A1A1A] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1A1A1A]"></span>
              </span>
            )}
          </button>
          <button
            id="tab_opt_followup"
            onClick={() => setActiveTab('followup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeTab === 'followup' 
                ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#E5E5E1]' 
                : 'text-[#71716A] hover:text-[#1A1A1A] hover:bg-white/50'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>AI Follow-Up</span>
          </button>
        </div>
      </div>

      {/* Pane Contents (Scrollable Pane) */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#F8F7F4]/40">

        {/* 1. REPORT PANE */}
        {activeTab === 'report' && (
          <div className="space-y-6 max-w-4xl">
            {meeting.report ? (
              <>
                {/* AI Executive summary */}
                <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl relative overflow-hidden shadow-sm">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-[#71716A] tracking-widest mb-4">
                    <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
                    AI Executive Summary
                  </h3>
                  <div className="prose max-w-none text-sm text-[#1A1A1A]">
                    {renderMarkdown(meeting.report.summary)}
                  </div>
                </div>

                {/* Grid for Decisions and Risks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Decisions */}
                  <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xs font-bold uppercase text-[#71716A] tracking-widest mb-4 flex items-center gap-1.5">
                      <span className="w-1.5 h-5 bg-[#1A1A1A] rounded-sm" />
                      Commitments & Decisions
                    </h3>
                    {meeting.report.decisions && meeting.report.decisions.length > 0 ? (
                      <ul className="space-y-3">
                        {meeting.report.decisions.map((decision, index) => (
                          <li key={index} className="flex gap-2.5 items-start text-xs leading-relaxed text-[#1A1A1A]">
                            <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-[#F8F7F4] border border-[#E5E5E1] text-[#1A1A1A] font-semibold font-mono flex items-center justify-center text-[9px]">
                              {index + 1}
                            </span>
                            <span>{decision}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#71716A] text-xs italic">No critical milestones or definitive decisions logged on this meeting sync.</p>
                    )}
                  </div>

                  {/* Risks panel */}
                  <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl shadow-sm border-l-4 border-l-rose-500">
                    <h3 className="text-xs font-bold uppercase text-[#71716A] tracking-widest mb-4 flex items-center gap-1.5">
                      Roadblocks & Risks
                    </h3>
                    {meeting.report.risks && meeting.report.risks.length > 0 ? (
                      <ul className="space-y-3">
                        {meeting.report.risks.map((risk, index) => (
                          <li key={index} className="flex gap-2.5 items-start text-xs leading-relaxed text-[#1A1A1A]">
                            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#71716A] text-xs italic">No immediate technical or resource roadblocks flagged.</p>
                    )}
                  </div>

                </div>

                {/* Template specifications block */}
                {meeting.report.templateSpecific && Object.keys(meeting.report.templateSpecific).length > 0 && (
                  <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl shadow-sm">
                    <h3 className="text-xs font-bold uppercase text-[#71716A] tracking-widest mb-4">
                      Context-Specific Analyses ({meeting.template})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(meeting.report.templateSpecific).map(([sectionTitle, desc]) => (
                        <div key={sectionTitle} className="border border-[#E5E5E1] bg-[#F8F7F4] p-4.5 rounded-xl">
                          <h4 className="text-sm font-serif font-semibold text-[#1A1A1A] mb-2">{sectionTitle}</h4>
                          <p className="text-xs text-[#71716A] leading-relaxed">
                            {Array.isArray(desc) ? desc.join(', ') : desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Meeting suggest */}
                {meeting.report.nextMeeting && (
                  <div className="bg-white border border-[#E5E5E1] p-5 rounded-2xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#F8F7F4] rounded-xl text-[#1A1A1A]">
                        <Calendar className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#71716A] tracking-wider">Next Suggested Session</span>
                        <p className="text-xs text-[#1A1A1A] font-semibold">{meeting.report.nextMeeting}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-[#71716A] text-sm">Draft analysis report is offline.</p>
              </div>
            )}
          </div>
        )}

        {/* 2. TRANSCRIPT TIMELINE PANE */}
        {activeTab === 'transcript' && (
          <div className="space-y-5 max-w-4xl">
            {/* Search/Filter Bar */}
            <div className="bg-[#1A1A1A]/5 border border-[#E5E5E1] p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#71716A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="inp_transcript_search"
                  type="text"
                  placeholder="Ask and search transcript words..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#E5E5E1] rounded-xl py-2 pl-9.5 pr-4 text-xs text-[#1A1A1A] placeholder-[#71716A]/60 focus:outline-none focus:border-[#71716A]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                <span className="text-[11px] text-[#71716A] shrink-0 font-medium">Speaker:</span>
                <button
                  id="btn_speaker_all"
                  onClick={() => setSelectedSpeaker('all')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold shrink-0 transition-colors ${
                    selectedSpeaker === 'all' 
                      ? 'bg-[#1A1A1A] text-white' 
                      : 'text-[#71716A] hover:text-[#1A1A1A]'
                  }`}
                >
                  All speakers
                </button>
                {uniqSpeakers.map(spk => (
                  <button
                    key={spk}
                    onClick={() => setSelectedSpeaker(spk)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold shrink-0 transition-colors ${
                      selectedSpeaker === spk 
                        ? 'bg-[#1A1A1A] text-white' 
                        : 'text-[#71716A] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {spk}
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript scroll log */}
            <div id="transcript_timeline_window" className="space-y-4 border-l border-[#E5E5E1] pl-5 ml-4.5 mt-2 py-2">
              {filteredDialogue.length > 0 ? (
                filteredDialogue.map((chunk, index) => {
                  const queryIndices = searchTerm ? chunk.text.toLowerCase().indexOf(searchTerm.toLowerCase()) : -1;
                  
                  return (
                    <div key={index} className="relative group/dialogue pb-1">
                      {/* Timeline Dot Indicator */}
                      <div className="absolute -left-[27.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#1A1A1A] group-hover/dialogue:bg-[#1A1A1A] transition-all duration-300" />
                      
                      <div className="bg-white p-4 rounded-xl border border-[#E5E5E1] hover:border-[#1A1A1A] transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${getSpeakerColor(chunk.speaker)}`}>
                              {chunk.speaker}
                            </span>
                            <span className="font-mono text-[10px] text-[#71716A] font-semibold bg-[#F8F7F4] px-2 py-0.5 rounded border border-[#E5E5E1]">
                              {formatSecs(chunk.start)} - {formatSecs(chunk.end)}
                            </span>
                          </div>
                        </div>

                        <p className="text-[#1A1A1A] text-sm leading-relaxed">
                          {searchTerm && queryIndices !== -1 ? (
                            <>
                              {chunk.text.substring(0, queryIndices)}
                              <span className="bg-[#1A1A1A]/10 text-[#1A1A1A] font-semibold px-0.5 py-0.2 select-all rounded">
                                {chunk.text.substring(queryIndices, queryIndices + searchTerm.length)}
                              </span>
                              {chunk.text.substring(queryIndices + searchTerm.length)}
                            </>
                          ) : (
                            chunk.text
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 bg-white border border-[#E5E5E1] rounded-2xl">
                  <p className="text-[#71716A] text-xs italic">No matching dialogue chunks logged matching Search constraints.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. ACTION ITEMS PANE */}
        {activeTab === 'actions' && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold uppercase text-[#71716A] tracking-wider mb-4 flex items-center gap-1.5">
                <CheckSquare className="w-5 h-5 text-[#1A1A1A]" />
                <span>Action assignments tracking ({meeting.actionItems.filter(e => e.status === 'completed').length}/{meeting.actionItems.length})</span>
              </h3>
              
              <div className="space-y-3">
                {meeting.actionItems && meeting.actionItems.length > 0 ? (
                  meeting.actionItems.map((action) => {
                    const isCompleted = action.status === 'completed';
                    return (
                      <div 
                        key={action.id}
                        id={`action_row_${action.id}`}
                        onClick={() => onToggleAction(meeting.id, action.id)}
                        className={`pointer border p-4 rounded-xl cursor-pointer flex items-start gap-4 transition-all duration-300 ${
                          isCompleted 
                            ? 'bg-[#F8F7F4]/50 border-[#E5E5E1] opacity-60 text-stone-400' 
                            : 'bg-white border-[#E5E5E1] hover:border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#F8F7F4]/20'
                        }`}
                      >
                        {/* Checkbox circle triggers toggle */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isCompleted 
                              ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' 
                              : 'border-[#71716A] group-hover:border-[#1A1A1A]'
                          }`}>
                            {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Content text */}
                        <div className="flex-1">
                          <p className={`text-sm leading-snug font-medium ${isCompleted ? 'line-through text-stone-400' : 'text-[#1A1A1A]'}`}>
                            {action.task}
                          </p>
                          <div className="flex items-center gap-3.5 mt-2.5 text-xs">
                            <span className="inline-flex items-center gap-1.5 text-[#71716A] bg-[#F8F7F4] px-2 py-0.5 rounded border border-[#E5E5E1]">
                              <User className="w-3.5 h-3.5 text-[#71716A]" />
                              <span className="font-semibold text-[10px] text-[#1A1A1A]">Assignee: {action.owner}</span>
                            </span>
                            <span className="text-[10px] text-[#71716A] font-mono flex items-center gap-1">
                              Deadline: {action.deadline}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[#71716A] text-xs italic">No actionable owner checklists were generated on this session.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. FOLLOW-UP WORKSPACE */}
        {activeTab === 'followup' && (
          <div className="space-y-6 max-w-4xl">
            {meeting.followUp ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Email block */}
                <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl flex flex-col h-[520px] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#71716A] uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-stone-500" />
                      Client Email Draft
                    </span>
                    <button
                      id="btn_copy_email"
                      onClick={() => executeClipboardCopy('email', meeting.followUp?.email || '')}
                      className="p-1.8 bg-white hover:bg-[#F8F7F4] text-[#1A1A1A] hover:text-black rounded-lg border border-[#E5E5E1] transition flex items-center gap-1 text-[11px]"
                    >
                      {copies['email'] ? <Check className="w-3.5 h-3.5 text-[#1A1A1A]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copies['email'] ? 'Copied ✓' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="flex-1 bg-[#F8F7F4] border border-[#E5E5E1] rounded-xl p-4 overflow-y-auto font-mono text-xs text-[#1A1A1A] leading-relaxed max-h-[420px] whitespace-pre-wrap select-all">
                    {meeting.followUp.email}
                  </div>
                </div>

                {/* Slack block */}
                <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl flex flex-col h-[520px] shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#71716A] uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-stone-500" />
                      Slack / Channels Broadcast
                    </span>
                    <button
                      id="btn_copy_slack"
                      onClick={() => executeClipboardCopy('slack', meeting.followUp?.slack || '')}
                      className="p-1.8 bg-white hover:bg-[#F8F7F4] text-[#1A1A1A] hover:text-black rounded-lg border border-[#E5E5E1] transition flex items-center gap-1 text-[11px]"
                    >
                      {copies['slack'] ? <Check className="w-3.5 h-3.5 text-[#1A1A1A]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copies['slack'] ? 'Copied ✓' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="flex-1 bg-[#F8F7F4] border border-[#E5E5E1] rounded-xl p-4 overflow-y-auto font-mono text-xs text-[#1A1A1A] leading-relaxed max-h-[420px] whitespace-pre-wrap select-all">
                    {meeting.followUp.slack}
                  </div>
                </div>

                {/* Recap workspace */}
                <div className="bg-white border border-[#E5E5E1] p-6 rounded-2xl col-span-1 lg:col-span-2 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#71716A] uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-stone-500" />
                      Executive Bullet Recap
                    </span>
                    <button
                      id="btn_copy_recap"
                      onClick={() => executeClipboardCopy('recap', meeting.followUp?.recap || '')}
                      className="p-1.8 bg-white hover:bg-[#F8F7F4] text-[#1A1A1A] hover:text-black rounded-lg border border-[#E5E5E1] transition flex items-center gap-1 text-[11px]"
                    >
                      {copies['recap'] ? <Check className="w-3.5 h-3.5 text-[#1A1A1A]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copies['recap'] ? 'Copied ✓' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="bg-[#F8F7F4] border border-[#E5E5E1] p-4.5 rounded-xl text-xs text-[#1A1A1A] leading-relaxed">
                    {meeting.followUp.recap}
                  </p>
                </div>

              </div>
            ) : (
              <p className="text-[#71716A] italic text-xs py-10 text-center">Follow ups have not been parsed on this simulation log.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
