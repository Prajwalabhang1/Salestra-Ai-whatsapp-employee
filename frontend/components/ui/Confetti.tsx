'use client'

import { useEffect, useRef } from 'react'

export function Confetti() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const particles: Particle[] = []
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']

        class Particle {
            x: number
            y: number
            vx: number
            vy: number
            color: string
            size: number
            rotation: number
            vRotation: number

            constructor() {
                this.x = canvas!.width / 2
                this.y = canvas!.height / 2
                this.vx = (Math.random() - 0.5) * 20
                this.vy = (Math.random() - 1) * 20
                this.color = colors[Math.floor(Math.random() * colors.length)]
                this.size = Math.random() * 8 + 4
                this.rotation = Math.random() * 360
                this.vRotation = (Math.random() - 0.5) * 10
            }

            update() {
                this.x += this.vx
                this.y += this.vy
                this.vy += 0.5 // Gravity
                this.rotation += this.vRotation
                this.size *= 0.99 // Shrink
            }

            draw() {
                if (!ctx) return
                ctx.save()
                ctx.translate(this.x, this.y)
                ctx.rotate((this.rotation * Math.PI) / 180)
                ctx.fillStyle = this.color
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size)
                ctx.restore()
            }
        }

        // Create particles
        for (let i = 0; i < 200; i++) {
            particles.push(new Particle())
        }

        let animationId: number

        function animate() {
            if (!ctx || !canvas) return
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.update()
                p.draw()

                if (p.y > canvas.height + 100) {
                    particles.splice(i, 1)
                }
            }

            if (particles.length > 0) {
                animationId = requestAnimationFrame(animate)
            }
        }

        animate()

        return () => {
            cancelAnimationFrame(animationId)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-50"
        />
    )
}
