import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Network, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react'
import { buildKnowledgeGraph, applyForceLayout, getGraphStats, getNeighbors, type KnowledgeGraph, type GraphNode } from '../graph'
import type { Note } from '../db/indexeddb'

interface GraphPageProps {
  notes: Note[]
  onBack: () => void
  onNodeClick: (noteId: string) => void
}

interface CanvasNode extends GraphNode {
  vx: number
  vy: number
}

const COLORS: Record<string, string> = {
  concept: '#6366f1',
  reading: '#f59e0b',
  practice: '#22c55e',
  idea: '#ec4899',
  card: '#8b5cf6',
  tutorial: '#06b6d4',
  project: '#14b8a6',
  other: '#64748b',
}

const GraphPage: React.FC<GraphPageProps> = ({
  notes,
  onBack,
  onNodeClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [stats, setStats] = useState({ nodeCount: 0, edgeCount: 0, isolatedCount: 0 })
  const animationRef = useRef<number>()

  // Initialize graph
  useEffect(() => {
    if (notes.length === 0) return

    // Convert notes to graph format
    const graphNotes = notes.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content,
      type: n.type as any,
      tags: n.tags || [],
    }))

    const builtGraph = buildKnowledgeGraph(graphNotes)
    const layoutedGraph = applyForceLayout(builtGraph, {
      width: 1200,
      height: 800,
      iterations: 200,
      spacing: 120,
    })

    setGraph(layoutedGraph)
    setStats(getGraphStats(layoutedGraph))

    // Initialize canvas nodes with positions from graph
    const canvasNodes: CanvasNode[] = Array.from(layoutedGraph.nodes.values()).map(n => ({
      ...n,
      vx: 0,
      vy: 0,
    }))
    setNodes(canvasNodes)
  }, [notes])

  // Draw graph
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || nodes.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ke-bg').trim() || '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Apply zoom and offset
    ctx.save()
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y)
    ctx.scale(zoom, zoom)

    // Center nodes around origin
    const centerX = width / 2
    const centerY = height / 2

    // Draw edges
    if (graph) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'
      ctx.lineWidth = 1.5

      graph.edges.forEach(edge => {
        const fromNode = nodes.find(n => n.id === edge.from)
        const toNode = nodes.find(n => n.id === edge.to)

        if (fromNode && toNode) {
          ctx.beginPath()
          ctx.moveTo(fromNode.x - centerX, fromNode.y - centerY)
          ctx.lineTo(toNode.x - centerX, toNode.y - centerY)
          ctx.stroke()
        }
      })
    }

    // Draw nodes
    nodes.forEach(node => {
      const x = node.x - centerX
      const y = node.y - centerY

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, node.radius, 0, Math.PI * 2)

      // Fill color based on type
      ctx.fillStyle = COLORS[node.type] || COLORS.other
      ctx.fill()

      // Border for selected/hovered
      if (selectedNode?.id === node.id || hoveredNode?.id === node.id) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3
        ctx.stroke()

        ctx.strokeStyle = COLORS[node.type] || COLORS.other
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Node label
      ctx.fillStyle = '#ffffff'
      ctx.font = `${10}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Truncate label if too long
      let label = node.label
      if (label.length > 12) {
        label = label.slice(0, 10) + '...'
      }

      ctx.fillText(label, x, y)
    })

    ctx.restore()
  }, [nodes, graph, zoom, offset, selectedNode, hoveredNode])

  // Animation loop for force simulation
  useEffect(() => {
    if (nodes.length === 0) return

    const animate = () => {
      const REPULSION = 3000
      const ATTRACTION = 0.05
      const DAMPING = 0.85

      setNodes(prevNodes => {
        const newNodes = prevNodes.map(n => ({ ...n, vx: 0, vy: 0 }))

        // Repulsion forces
        for (let i = 0; i < newNodes.length; i++) {
          for (let j = i + 1; j < newNodes.length; j++) {
            const n1 = newNodes[i]
            const n2 = newNodes[j]

            const dx = n2.x - n1.x
            const dy = n2.y - n1.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1

            const force = REPULSION / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            newNodes[i].vx -= fx
            newNodes[i].vy -= fy
            newNodes[j].vx += fx
            newNodes[j].vy += fy
          }
        }

        // Attraction forces along edges
        if (graph) {
          graph.edges.forEach(edge => {
            const n1 = newNodes.find(n => n.id === edge.from)
            const n2 = newNodes.find(n => n.id === edge.to)

            if (n1 && n2) {
              const dx = n2.x - n1.x
              const dy = n2.y - n1.y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1

              const force = dist * ATTRACTION
              const fx = (dx / dist) * force
              const fy = (dy / dist) * force

              n1.vx += fx
              n1.vy += fy
              n2.vx -= fx
              n2.vy -= fy
            }
          })
        }

        // Apply forces with damping
        return newNodes.map(n => ({
          ...n,
          x: n.x + n.vx * DAMPING,
          y: n.y + n.vy * DAMPING,
          vx: n.vx * DAMPING,
          vy: n.vy * DAMPING,
        }))
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [graph])

  // Redraw on changes
  useEffect(() => {
    draw()
  }, [draw])

  // Handle mouse events
  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Transform to graph coordinates
    const width = canvas.width
    const height = canvas.height
    return {
      x: (x - width / 2 - offset.x) / zoom,
      y: (y - height / 2 - offset.y) / zoom,
    }
  }

  const findNodeAtPos = (x: number, y: number): GraphNode | null => {
    // Account for centering offset
    const width = canvasRef.current?.width || 0
    const height = canvasRef.current?.height || 0
    const centerX = width / 2
    const centerY = height / 2

    for (const node of nodes) {
      const dx = (node.x - centerX) - x
      const dy = (node.y - centerY) - y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= node.radius) {
        return node
      }
    }
    return null
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }))
      return
    }

    const pos = getMousePos(e)
    const node = findNodeAtPos(pos.x, pos.y)
    setHoveredNode(node)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e)
    const node = findNodeAtPos(pos.x, pos.y)

    if (node) {
      setSelectedNode(node)
    } else {
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    const pos = getMousePos(e)
    const node = findNodeAtPos(pos.x, pos.y)

    if (node) {
      onNodeClick(node.id)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)))
  }

  const resetView = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  const zoomIn = () => setZoom(prev => Math.min(3, prev * 1.2))
  const zoomOut = () => setZoom(prev => Math.max(0.3, prev / 1.2))

  return (
    <div className="ke-graph-page">
      {/* Header */}
      <header className="ke-graph-page__header">
        <div className="ke-graph-page__title">
          <Network size={20} />
          <span>知识图谱</span>
        </div>
        <div className="ke-graph-page__controls">
          <button className="ke-header__icon-btn" onClick={zoomIn} title="放大">
            <ZoomIn size={18} />
          </button>
          <button className="ke-header__icon-btn" onClick={zoomOut} title="缩小">
            <ZoomOut size={18} />
          </button>
          <button className="ke-header__icon-btn" onClick={resetView} title="重置视图">
            <Maximize2 size={18} />
          </button>
          <button className="ke-header__action-btn" onClick={onBack}>
            返回
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div className="ke-graph-page__canvas" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          style={{ cursor: isDragging ? 'grabbing' : hoveredNode ? 'pointer' : 'grab' }}
        />

        {/* Stats */}
        <div className="ke-graph-page__stats">
          <div className="ke-graph-page__stats-title">图谱统计</div>
          <div className="ke-graph-page__stats-grid">
            <div className="ke-graph-page__stat">
              <div className="ke-graph-page__stat-value">{stats.nodeCount}</div>
              <div className="ke-graph-page__stat-label">节点</div>
            </div>
            <div className="ke-graph-page__stat">
              <div className="ke-graph-page__stat-value">{stats.edgeCount}</div>
              <div className="ke-graph-page__stat-label">连接</div>
            </div>
            <div className="ke-graph-page__stat">
              <div className="ke-graph-page__stat-value">{stats.isolatedCount}</div>
              <div className="ke-graph-page__stat-label">孤立</div>
            </div>
          </div>
        </div>

        {/* Hover tooltip */}
        {hoveredNode && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'var(--ke-bg-elevated)',
              border: '1px solid var(--ke-border)',
              borderRadius: 'var(--ke-radius-md)',
              padding: '12px 16px',
              boxShadow: 'var(--ke-shadow-md)',
              maxWidth: 200,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{hoveredNode.label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ke-text-muted)' }}>
              类型: {hoveredNode.type} | 连接: {hoveredNode.linkCount}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GraphPage
