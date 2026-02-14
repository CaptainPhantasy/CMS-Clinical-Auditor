import React, { useState, useEffect } from 'react';
import { HistoryItem } from '../types';
import { getHistory, deleteHistoryItem } from '../services/storageService';
import ReactMarkdown from 'react-markdown';
import { Search, Trash2, Calendar, ChevronDown, ChevronUp, Copy, Check, Download, Filter, X } from 'lucide-react';

const HistoryView: React.FC = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    setItems(getHistory());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteHistoryItem(id);
    setItems(updated);
  };

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    if (items.length === 0) return;

    const headers = ['Timestamp', 'Tags', 'Original Input', 'Translated Result'];
    const csvContent = [
      headers.join(','),
      ...items.map(item => {
        const date = new Date(item.timestamp).toISOString();
        const tags = (item.tags || []).join(';');
        // Escape quotes and handle newlines for CSV format
        const input = `"${item.input.replace(/"/g, '""')}"`;
        const output = `"${item.result.text.replace(/"/g, '""')}"`;
        return `${date},${tags},${input},${output}`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cms_audit_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Extract unique tags
  const allTags = Array.from(new Set(items.flatMap(item => item.tags || []))).sort();

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.input.toLowerCase().includes(search.toLowerCase()) || 
      item.result.text.toLowerCase().includes(search.toLowerCase()) ||
      item.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    
    const matchesTag = selectedTag ? item.tags?.includes(selectedTag) : true;

    return matchesSearch && matchesTag;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Compliance History</h2>
           <p className="text-slate-500 text-sm">Manage and export your audit logs.</p>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search records..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium whitespace-nowrap"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center text-xs font-bold text-slate-400 uppercase mr-1 shrink-0">
            <Filter className="w-3 h-3 mr-1" />
            Filter:
          </div>
          <button
             onClick={() => setSelectedTag(null)}
             className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
               selectedTag === null 
                 ? 'bg-slate-800 text-white border-slate-800' 
                 : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
             }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                selectedTag === tag
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400">
            <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
               <Search className="w-6 h-6 text-slate-300" />
            </div>
            <p>No records found matching your criteria.</p>
            {selectedTag && (
              <button 
                onClick={() => setSelectedTag(null)}
                className="mt-2 text-blue-600 text-sm font-medium hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer group"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <div className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.tags?.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-100">
                        {tag}
                      </span>
                    ))}
                    <span className="flex items-center text-xs text-slate-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium truncate">{item.input}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedId === item.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {expandedId === item.id && (
                <div className="border-t border-slate-100 bg-slate-50 p-6 cursor-auto animate-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Original Clinical Note</h4>
                    <p className="text-slate-700 bg-white p-4 rounded-lg border border-slate-200 text-sm leading-relaxed">{item.input}</p>
                  </div>
                  
                  <div className="relative">
                    <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">CMS Compliant Output</h4>
                    <button 
                      onClick={(e) => handleCopy(item.result.text, item.id, e)}
                      className="absolute right-0 top-0 flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                    >
                       {copiedId === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                       <span>{copiedId === item.id ? 'Copied' : 'Copy Text'}</span>
                    </button>
                    <div className="bg-white p-6 rounded-lg border border-emerald-100 shadow-sm prose prose-sm max-w-none prose-p:text-slate-700 prose-headings:text-slate-800">
                      <ReactMarkdown>{item.result.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryView;