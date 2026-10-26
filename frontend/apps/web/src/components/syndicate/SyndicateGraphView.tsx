import React, { useEffect, useRef, useState, useMemo } from 'react';
import cytoscape, { Core, EventObject } from 'cytoscape';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  Flame,
  ShieldAlert,
  Search,
  SlidersHorizontal,
  Code2
} from 'lucide-react';
import { Button, Notice, Skeleton } from '../ui';
import { ProofSidePanel } from './ProofSidePanel';
import { useSyndicateGraph, useReseedSyndicate } from '../../api/queries';

export const SyndicateGraphView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const { data: graphData, isLoading, isError, refetch } = useSyndicateGraph();
  const reseedMutation = useReseedSyndicate();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'cose' | 'circle' | 'concentric'>('cose');
  const [showFacultyNodes, setShowFacultyNodes] = useState(true);
  const [cartelHighlight, setCartelHighlight] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCypherModal, setShowCypherModal] = useState(false);

  // Initialize and update Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || !graphData?.graph?.elements) return;

    // Filter elements if showFacultyNodes is toggled
    const rawElements = graphData.graph.elements;
    const filteredElements = showFacultyNodes
      ? rawElements
      : rawElements.filter((el: any) => el.data.nodeType === 'college' || el.data.edgeType === 'shared_severity');

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: filteredElements,
      boxSelectionEnabled: false,
      autounselectify: false,
      wheelSensitivity: 0.25,
      style: [
        // College Nodes (Large Blue Nodes)
        {
          selector: 'node[nodeType = "college"]',
          style: {
            'background-color': 'data(color)',
            width: 'data(size)',
            height: 'data(size)',
            label: 'data(label)',
            'font-size': '11px',
            'font-weight': 700,
            color: '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-outline-color': '#0f172a',
            'text-outline-width': 2.5,
            'text-wrap': 'wrap',
            'text-max-width': '85px',
            'border-width': 3,
            'border-color': '#93c5fd',
            'shadow-blur': 12,
            'shadow-color': 'rgba(37, 99, 235, 0.4)',
            'shadow-opacity': 0.8,
            'transition-property': 'background-color, border-color, border-width, width, height',
            'transition-duration': 250,
          },
        },
        // Faculty Nodes (Smaller Red Nodes)
        {
          selector: 'node[nodeType = "faculty"]',
          style: {
            'background-color': 'data(color)',
            width: 'data(size)',
            height: 'data(size)',
            label: 'data(label)',
            'font-size': '9px',
            'font-weight': 600,
            color: '#7f1d1d',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'border-width': 2,
            'border-color': '#fca5a5',
            'shadow-blur': 6,
            'shadow-color': 'rgba(239, 68, 68, 0.3)',
            'shadow-opacity': 0.6,
          },
        },
        // Severity Connection Lines (Thickness = Severity of shared resources)
        {
          selector: 'edge[edgeType = "shared_severity"]',
          style: {
            width: 'data(width)',
            'line-color': 'data(lineColor)',
            'curve-style': 'bezier',
            opacity: 0.85,
            'target-arrow-shape': 'none',
          },
        },
        // Employment Connection Lines
        {
          selector: 'edge[edgeType = "employs"]',
          style: {
            width: 1.5,
            'line-color': '#cbd5e1',
            'line-style': 'dashed',
            'line-dash-pattern': [4, 3],
            'curve-style': 'bezier',
            opacity: 0.6,
          },
        },
        // Highlighted Cartel Nodes
        {
          selector: 'node[isCartelMember = true]',
          style: {
            'border-width': 4,
            'border-color': '#f59e0b',
            'shadow-color': 'rgba(245, 158, 11, 0.6)',
            'shadow-blur': 18,
          },
        },
        // Selected Node Highlight
        {
          selector: 'node:selected',
          style: {
            'border-width': 6,
            'border-color': '#f59e0b',
            'border-opacity': 1,
            'shadow-color': '#f59e0b',
            'shadow-blur': 25,
          },
        },
        // Dimmed Nodes when Searching
        {
          selector: '.dimmed',
          style: {
            opacity: 0.15,
          },
        },
        // Matched Search Nodes
        {
          selector: '.matched',
          style: {
            'border-color': '#10b981',
            'border-width': 5,
            opacity: 1,
            'shadow-color': '#10b981',
            'shadow-blur': 20,
          },
        },
      ] as any,
      layout: {
        name: layoutMode,
        animate: true,
        animationDuration: 600,
        padding: 50,
      } as any,
    });

    // Tap node handler -> Opens side panel with definitive proof
    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target;
      setSelectedNodeId(node.id());
    });

    // Tap background handler -> Deselect
    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        setSelectedNodeId(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData, layoutMode, showFacultyNodes]);

  // Handle Search Filtering
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    if (!searchQuery.trim()) {
      cy.elements().removeClass('dimmed matched');
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    cy.batch(() => {
      cy.elements().addClass('dimmed');
      const matched = cy.nodes().filter((node) => {
        const d = node.data();
        return (
          d.fullName?.toLowerCase().includes(q) ||
          d.label?.toLowerCase().includes(q) ||
          d.state?.toLowerCase().includes(q) ||
          d.hash?.toLowerCase().includes(q)
        );
      });
      matched.removeClass('dimmed').addClass('matched');
      matched.connectedEdges().removeClass('dimmed');
    });
  }, [searchQuery]);

  // Zoom / Pan Helpers
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 40);

  // Focus on 5-College Cartel Ring
  const handleFocusCartel = () => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const cartelNodes = cy.nodes('[isCartelMember = true]');
    if (cartelNodes.length > 0) {
      cy.animate({
        fit: { eles: cartelNodes, padding: 60 },
        duration: 800,
      });
      cartelNodes.select();
      setSelectedNodeId('COL-CARTEL-01');
    }
  };

  const cartelInfo = graphData?.cartel;

  return (
    <div className="relative flex h-full min-h-[640px] w-full flex-col overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 shadow-xl">
      {/* Top Banner / Detection Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-white sm:text-base">
                Network Syndicate Fraud Engine
              </h2>
              <span className="rounded-full bg-rose-500/20 border border-rose-400/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                5-COLLEGE CARTEL DETECTED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multi-hop Cypher relationship traversal exposing closed rings of shared ghost faculty rosters
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleFocusCartel}
            className="border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          >
            <Flame className="h-4 w-4 mr-1 text-amber-400" />
            Highlight 5-College Cartel
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCypherModal(true)}
            className="border-white/20 bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <Code2 className="h-4 w-4 mr-1 text-indigo-400" />
            Inspect Cypher Queries
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => reseedMutation.mutate()}
            isLoading={reseedMutation.isPending}
            className="border-white/20 bg-white/5 text-slate-300 hover:bg-white/10"
            title="Re-seed synthetic colleges and ghost faculty using Faker.js"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Re-seed Faker.js
          </Button>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Layouts, Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/60 px-6 py-2.5 text-xs text-slate-300 backdrop-blur">
        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search college, city, or faculty hash…"
            className="h-8 w-full rounded-lg border border-white/10 bg-slate-800/80 pl-8 pr-3 text-xs text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* View Controls & Toggles */}
        <div className="flex items-center gap-2">
          {/* Layout Select */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-800/60 p-0.5">
            {(['cose', 'circle', 'concentric'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayoutMode(mode)}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                  layoutMode === mode
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'cose' ? 'Force-Directed' : mode}
              </button>
            ))}
          </div>

          {/* Toggle Faculty Nodes */}
          <button
            onClick={() => setShowFacultyNodes((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold transition ${
              showFacultyNodes
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            {showFacultyNodes ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Faculty Nodes (Red)
          </button>
        </div>

        {/* Visual Legend */}
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-full bg-blue-600 border border-blue-300" />
            <span>Colleges (Large Blue)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 border border-rose-300" />
            <span>Faculty Hashes (Small Red)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-6 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600" />
            <span>Line Thickness = Severity</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 bg-radial from-slate-900/40 to-slate-950">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center space-y-3">
            <div className="text-center text-slate-400">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
              <p className="mt-2 text-sm font-medium">Computing graph topology & Cypher traversal…</p>
            </div>
          </div>
        ) : isError ? (
          <div className="p-8">
            <Notice tone="bad">
              Failed to load syndicate graph network from backend.
            </Notice>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="h-full w-full min-h-[560px]"
            style={{ cursor: 'grab' }}
          />
        )}

        {/* Floating Zoom & Center Buttons */}
        <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 p-1 backdrop-blur shadow-lg">
          <button
            onClick={handleZoomIn}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            title="Zoom In"
            type="button"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            title="Zoom Out"
            type="button"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleFit}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            title="Fit to Screen"
            type="button"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Floating Cartel Summary Badge */}
        {cartelInfo && (
          <div className="absolute top-5 left-5 z-20 max-w-sm rounded-xl border border-rose-500/30 bg-slate-950/85 p-3.5 text-xs backdrop-blur shadow-xl">
            <div className="flex items-center gap-2 font-bold text-rose-400">
              <ShieldAlert className="h-4 w-4" />
              <span>5-College Cartel Ring Detected</span>
            </div>
            <p className="mt-1 text-slate-300 leading-relaxed text-[11.5px]">
              {cartelInfo.description}
            </p>
            <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-slate-400">
              <span>Average Risk: <strong className="text-rose-400 font-bold">{cartelInfo.riskScoreAvg} / 100</strong></span>
              <span>Roster Clones: <strong className="text-amber-400 font-bold">{cartelInfo.totalSharedGhostFaculty}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Proof Side Panel */}
      <ProofSidePanel
        nodeId={selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        onSelectNode={(id) => {
          setSelectedNodeId(id);
          if (cyRef.current) {
            const target = cyRef.current.getElementById(id);
            if (target && target.length > 0) {
              cyRef.current.animate({ center: { eles: target }, zoom: 1.6, duration: 500 });
              target.select();
            }
          }
        }}
      />

      {/* Cypher Queries Inspection Modal */}
      {showCypherModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2 font-bold text-base">
                <Code2 className="h-5 w-5 text-indigo-400" />
                <span>Neo4j Cypher Traversal & Detection Queries</span>
              </div>
              <button
                onClick={() => setShowCypherModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs font-mono">
              <div>
                <p className="font-sans font-bold text-indigo-300 text-xs mb-1">
                  1. Multi-Hop Path Relationship Traversal (2 to 4 hops):
                </p>
                <pre className="rounded-lg bg-slate-950 p-3 text-emerald-300 overflow-x-auto border border-white/5">
                  {graphData?.cypherQueries?.detectMultiHop}
                </pre>
              </div>
              <div>
                <p className="font-sans font-bold text-rose-300 text-xs mb-1">
                  2. Closed Cycle / Cartel Detection (3 to 6 node rings):
                </p>
                <pre className="rounded-lg bg-slate-950 p-3 text-rose-300 overflow-x-auto border border-white/5">
                  {graphData?.cypherQueries?.detectCycles}
                </pre>
              </div>
              <div>
                <p className="font-sans font-bold text-amber-300 text-xs mb-1">
                  3. Resource Sharing Severity Aggregation (Connection Thickness):
                </p>
                <pre className="rounded-lg bg-slate-950 p-3 text-amber-300 overflow-x-auto border border-white/5">
                  {graphData?.cypherQueries?.aggregateSeverity}
                </pre>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCypherModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
