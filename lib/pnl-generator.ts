
export interface PnLData {
    marketQuestion: string
    side: "YES" | "NO"
    amount: number
    pnl: number
    pnlPercent: number
    currentValue: number
}

export const generatePnLImage = async (data: PnLData): Promise<string> => {
    const canvas = document.createElement("canvas")
    canvas.width = 600 // Reduced from 800
    canvas.height = 750 // Reduced from 1000
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")

    // Background
    ctx.fillStyle = "#0B0B0D"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Gradient Overlay (Radial) - simplified
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 600)
    grad.addColorStop(0, "rgba(107, 158, 120, 0.15)")
    grad.addColorStop(1, "rgba(107, 158, 120, 0)")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Simplified grid - fewer lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)"
    ctx.lineWidth = 1
    for (let i = 0; i < canvas.width; i += 60) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, canvas.height)
        ctx.stroke()
    }
    for (let i = 0; i < canvas.height; i += 60) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(canvas.width, i)
        ctx.stroke()
    }

    // Header Logo
    ctx.fillStyle = "#6B9E78"
    ctx.beginPath()
    ctx.arc(60, 60, 22, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#000000"
    ctx.font = "bold 18px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("TM", 60, 66)

    ctx.fillStyle = "#FFFFFF"
    ctx.font = "bold 24px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText("TRENCHMARKET", 98, 68)

    // Market Question
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
    ctx.font = "medium 30px sans-serif"
    const lines = wrapText(ctx, data.marketQuestion, canvas.width - 90)
    lines.forEach((line, i) => {
        ctx.fillText(line, 45, 150 + i * 38)
    })

    // Side Badge
    const badgeY = 300
    ctx.fillStyle = data.side === "YES" ? "rgba(107, 158, 120, 0.2)" : "rgba(166, 124, 124, 0.2)"
    ctx.strokeStyle = data.side === "YES" ? "rgba(107, 158, 120, 0.5)" : "rgba(166, 124, 124, 0.5)"
    ctx.lineWidth = 2
    roundRect(ctx, 225, badgeY, 150, 45, 22, true, true)

    ctx.fillStyle = data.side === "YES" ? "#6B9E78" : "#A67C7C"
    ctx.font = "bold 22px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(data.side.toUpperCase(), 300, badgeY + 32)

    // PnL Percent
    ctx.fillStyle = data.pnl >= 0 ? "#6B9E78" : "#A67C7C"
    ctx.font = "900 105px sans-serif"
    ctx.textAlign = "center"
    const pnlText = `${data.pnl >= 0 ? "+" : ""}${data.pnlPercent.toFixed(1)}%`
    ctx.fillText(pnlText, 300, 450)

    // PnL SOL
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
    ctx.font = "26px monospace"
    ctx.fillText(`Profit: ${data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(4)} SOL`, 300, 503)

    // Bottom Stats
    const statsY = 615
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"
    ctx.beginPath()
    ctx.moveTo(45, statsY - 30)
    ctx.lineTo(555, statsY - 30)
    ctx.stroke()

    // Investment
    ctx.textAlign = "left"
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
    ctx.font = "18px sans-serif"
    ctx.fillText("INVESTMENT", 45, statsY)
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "bold 27px monospace"
    ctx.fillText(`${data.amount.toFixed(4)} SOL`, 45, statsY + 38)

    // Current Value
    ctx.textAlign = "right"
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
    ctx.font = "18px sans-serif"
    ctx.fillText("CURRENT VALUE", 555, statsY)
    ctx.fillStyle = "#6B9E78"
    ctx.font = "bold 27px monospace"
    ctx.fillText(`${data.currentValue.toFixed(4)} SOL`, 555, statsY + 38)

    // Footer
    ctx.textAlign = "left"
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
    ctx.font = "15px sans-serif"
    ctx.fillText("JOIN THE TRENCHES", 45, 713)
    ctx.textAlign = "right"
    ctx.fillText("TRENCH-MARKET.FUN", 555, 713)

    return canvas.toDataURL("image/png")
}

// Helpers
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(" ")
    const lines = []
    let currentLine = words[0]

    for (let i = 1; i < words.length; i++) {
        const word = words[i]
        const width = ctx.measureText(currentLine + " " + word).width
        if (width < maxWidth) {
            currentLine += " " + word
        } else {
            lines.push(currentLine)
            currentLine = word
        }
    }
    lines.push(currentLine)
    return lines
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean
) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    if (fill) ctx.fill()
    if (stroke) ctx.stroke()
}
