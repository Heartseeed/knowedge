/**
 * Knowledge Graph Data Structures and Algorithms
 * 
 * Supports graph representation, layout algorithms, and relationship types
 */

import { parseWikiLinks } from './backlinks'

// Note type from our system
interface GraphNote {
  id: string
  title: string
  content: string
  type: 'concept' | 'reading' | 'practice' | 'idea' | 'card'
  tags: string[]
}

// Node in the knowledge graph
export interface GraphNode {
  id: string
  label: string
  type: 'concept' | 'reading' | 'practice' | 'idea' | 'card'
  x: number
  y: number
  // Visual properties
  radius: number
  color: string
  // Data properties
  linkCount: number
  tagCount: number
  updatedAt: number
}

// Edge types for different relationship meanings
export type EdgeType = 'causal' | 'extends' | 'contrast' | 'reference'

// Edge in the knowledge graph
export interface GraphEdge {
  id: string
  from: string
  to: string
  type: EdgeType
  // Layout properties
  strength: number  // For edge bundling
}

// Complete graph structure
export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  // Metadata
  nodeCount: number
  edgeCount: number
  isolatedNodes: string[]  // Nodes with no connections
}

// Layout algorithm options
export interface LayoutOptions {
  width: number
  height: number
  spacing: number
  iterations: number
  forceStrength: number
}

// Default layout options
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  width: 800,
  height: 600,
  spacing: 150,
  iterations: 100,
  forceStrength: 1,
}

// Color mapping for note types
const TYPE_COLORS: Record<string, string> = {
  concept: '#6366f1',   // Indigo
  reading: '#f59e0b',    // Amber
  practice: '#10b981',   // Emerald
  idea: '#ec4899',       // Pink
  card: '#8b5cf6',       // Purple
}

/**
 * Build a knowledge graph from notes
 */
export function buildKnowledgeGraph(notes: GraphNote[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const titleToId = new Map<string, string>()
  
  // Create title -> id mapping for link resolution
  notes.forEach(n => titleToId.set(n.title.toLowerCase(), n.id))
  
  // Create nodes
  notes.forEach(note => {
    const links = parseWikiLinks(note.content)
    const linkedNoteIds = links
      .map(l => titleToId.get(l.target.toLowerCase()) || l.target)
      .filter(id => id !== note.id)
    
    nodes.set(note.id, {
      id: note.id,
      label: note.title,
      type: note.type,
      x: Math.random() * DEFAULT_LAYOUT_OPTIONS.width,
      y: Math.random() * DEFAULT_LAYOUT_OPTIONS.height,
      radius: 20 + Math.min(linkedNoteIds.length * 3, 20),  // Size by link count
      color: TYPE_COLORS[note.type] || '#64748b',
      linkCount: linkedNoteIds.length,
      tagCount: note.tags.length,
      updatedAt: Date.now(),
    })
    
    // Create edges
    linkedNoteIds.forEach(targetId => {
      if (nodes.has(targetId)) {
        // Avoid duplicate edges
        const edgeExists = edges.some(
          e => (e.from === note.id && e.to === targetId) ||
               (e.from === targetId && e.to === note.id)
        )
        
        if (!edgeExists) {
          edges.push({
            id: `e_${note.id}_${targetId}`,
            from: note.id,
            to: targetId,
            type: 'reference',
            strength: 1,
          })
        }
      }
    })
  })
  
  // Find isolated nodes
  const connectedNodeIds = new Set<string>()
  edges.forEach(e => {
    connectedNodeIds.add(e.from)
    connectedNodeIds.add(e.to)
  })
  
  const isolatedNodes = [...nodes.keys()].filter(id => !connectedNodeIds.has(id))
  
  return {
    nodes,
    edges,
    nodeCount: nodes.size,
    edgeCount: edges.length,
    isolatedNodes,
  }
}

/**
 * Force-directed layout algorithm
 * Simple implementation - for production consider using d3-force
 */
export function applyForceLayout(graph: KnowledgeGraph, options: Partial<LayoutOptions> = {}): KnowledgeGraph {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options }
  
  const nodes = Array.from(graph.nodes.values())
  const edges = graph.edges
  
  // Clone nodes for mutation
  const positionedNodes = nodes.map(n => ({ ...n }))
  
  // Repulsion between all nodes
  const REPULSION = 5000
  // Attraction along edges
  const ATTRACTION = 0.1
  
  for (let iter = 0; iter < opts.iterations; iter++) {
    // Calculate forces
    const forces = new Map<string, { fx: number; fy: number }>()
    
    positionedNodes.forEach(n => {
      forces.set(n.id, { fx: 0, fy: 0 })
    })
    
    // Repulsion forces
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const n1 = positionedNodes[i]
        const n2 = positionedNodes[j]
        
        const dx = n2.x - n1.x
        const dy = n2.y - n1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        
        const force = REPULSION / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        
        forces.get(n1.id)!.fx -= fx
        forces.get(n1.id)!.fy -= fy
        forces.get(n2.id)!.fx += fx
        forces.get(n2.id)!.fy += fy
      }
    }
    
    // Attraction forces along edges
    edges.forEach(edge => {
      const fromNode = positionedNodes.find(n => n.id === edge.from)
      const toNode = positionedNodes.find(n => n.id === edge.to)
      
      if (!fromNode || !toNode) return
      
      const dx = toNode.x - fromNode.x
      const dy = toNode.y - fromNode.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      
      const force = dist * ATTRACTION
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      
      forces.get(fromNode.id)!.fx += fx
      forces.get(fromNode.id)!.fy += fy
      forces.get(toNode.id)!.fx -= fx
      forces.get(toNode.id)!.fy -= fy
    })
    
    // Apply forces with damping
    const damping = 0.85
    
    positionedNodes.forEach(n => {
      const f = forces.get(n.id)!
      
      // Center gravity to prevent drift
      const centerX = opts.width / 2
      const centerY = opts.height / 2
      const toCenterX = centerX - n.x
      const toCenterY = centerY - n.y
      
      n.x += (f.fx + toCenterX * 0.01) * damping
      n.y += (f.fy + toCenterY * 0.01) * damping
      
      // Keep within bounds
      n.x = Math.max(n.radius, Math.min(opts.width - n.radius, n.x))
      n.y = Math.max(n.radius, Math.min(opts.height - n.radius, n.y))
    })
  }
  
  // Update graph with new positions
  const newNodes = new Map<string, GraphNode>()
  positionedNodes.forEach(n => newNodes.set(n.id, n))
  
  return {
    ...graph,
    nodes: newNodes,
  }
}

/**
 * Find neighbors of a node
 */
export function getNeighbors(nodeId: string, graph: KnowledgeGraph): GraphNode[] {
  const neighborIds = new Set<string>()
  
  graph.edges.forEach(e => {
    if (e.from === nodeId) neighborIds.add(e.to)
    if (e.to === nodeId) neighborIds.add(e.from)
  })
  
  return [...neighborIds].map(id => graph.nodes.get(id)! ).filter(Boolean)
}

/**
 * Get nodes connected to a specific node
 */
export function getConnectedNodes(nodeId: string, graph: KnowledgeGraph): GraphNode[] {
  return getNeighbors(nodeId, graph)
}

/**
 * Calculate graph statistics
 */
export function getGraphStats(graph: KnowledgeGraph) {
  const avgDegree = graph.nodeCount > 0 
    ? (graph.edgeCount * 2) / graph.nodeCount 
    : 0
  
  const degreeDistribution: Record<number, number> = {}
  graph.nodes.forEach(n => {
    const degree = graph.edges.filter(
      e => e.from === n.id || e.to === n.id
    ).length
    degreeDistribution[degree] = (degreeDistribution[degree] || 0) + 1
  })
  
  return {
    nodeCount: graph.nodeCount,
    edgeCount: graph.edgeCount,
    isolatedCount: graph.isolatedNodes.length,
    avgDegree,
    degreeDistribution,
    density: graph.nodeCount > 1 
      ? (graph.edgeCount * 2) / (graph.nodeCount * (graph.nodeCount - 1)) 
      : 0,
  }
}

/**
 * Find clusters using connected components
 */
export function findClusters(graph: KnowledgeGraph): string[][] {
  const visited = new Set<string>()
  const clusters: string[][] = []
  
  graph.nodes.forEach((_, nodeId) => {
    if (visited.has(nodeId)) return
    
    const cluster: string[] = []
    const queue = [nodeId]
    
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      
      visited.add(current)
      cluster.push(current)
      
      // Add neighbors to queue
      graph.edges.forEach(e => {
        if (e.from === current && !visited.has(e.to)) {
          queue.push(e.to)
        }
        if (e.to === current && !visited.has(e.from)) {
          queue.push(e.from)
        }
      })
    }
    
    clusters.push(cluster)
  })
  
  return clusters
}

/**
 * Export graph to JSON for visualization libraries (like D3, vis.js)
 */
export function exportGraphForVisualization(graph: KnowledgeGraph) {
  return {
    nodes: Array.from(graph.nodes.values()).map(n => ({
      id: n.id,
      label: n.label,
      x: n.x,
      y: n.y,
      size: n.radius,
      color: n.color,
      type: n.type,
    })),
    edges: graph.edges.map(e => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: e.type,
    })),
  }
}
