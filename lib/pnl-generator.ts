
export interface PnLData {
    marketQuestion: string
    side: "YES" | "NO"
    amount: number
    pnl: number
    pnlPercent: number
    currentValue: number
    tokenMint?: string
}

export const generatePnLImage = async (data: PnLData): Promise<string> => {
    const canvas = document.createElement("canvas")
    canvas.width = 600
    canvas.height = 750
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Could not get canvas context")

    // Background
    ctx.fillStyle = "#0B0B0D"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Gradient Overlay (Radial) - Mesh vibe
    const grad = ctx.createRadialGradient(canvas.width * 0.2, canvas.height * 0.2, 0, canvas.width * 0.2, canvas.height * 0.2, 500)
    grad.addColorStop(0, "rgba(105, 255, 148, 0.12)")
    grad.addColorStop(1, "rgba(105, 255, 148, 0)")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const grad2 = ctx.createRadialGradient(canvas.width * 0.8, canvas.height * 0.8, 0, canvas.width * 0.8, canvas.height * 0.8, 500)
    grad2.addColorStop(0, "rgba(255, 0, 255, 0.08)")
    grad2.addColorStop(1, "rgba(255, 0, 255, 0)")
    ctx.fillStyle = grad2
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Background Token Logo
    if (data.tokenMint) {
        try {
            const logoImg = new Image()
            logoImg.crossOrigin = "anonymous"
            logoImg.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${data.tokenMint}`
            await new Promise((resolve) => {
                logoImg.onload = resolve
                logoImg.onerror = resolve // Continue even if logo fails
            })

            if (logoImg.complete && logoImg.naturalWidth > 0) {
                ctx.save()
                ctx.globalAlpha = 0.12
                ctx.translate(canvas.width / 2, canvas.height / 2)
                ctx.rotate(20 * Math.PI / 180)
                const size = 500
                ctx.drawImage(logoImg, -size / 2, -size / 2, size, size)
                ctx.restore()
            }
        } catch (e) {
            console.warn("Failed to draw background logo on canvas")
        }
    }

    // Grid
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

    // Glassy Shine (static reflection for image)
    const shineGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    shineGrad.addColorStop(0, "rgba(255, 255, 255, 0)")
    shineGrad.addColorStop(0.45, "rgba(255, 255, 255, 0)")
    shineGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.15)")
    shineGrad.addColorStop(0.55, "rgba(255, 255, 255, 0)")
    shineGrad.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx.fillStyle = shineGrad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Header Logo
    ctx.shadowBlur = 15
    ctx.shadowColor = "#69ff94"
    ctx.fillStyle = "#69ff94"
    ctx.beginPath()
    ctx.arc(60, 60, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = "#000000"
    ctx.font = "bold 18px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("TM", 60, 66)

    ctx.fillStyle = "#69ff94"
    ctx.font = "bold 26px sans-serif"
    ctx.textAlign = "left"
    ctx.shadowBlur = 10
    ctx.shadowColor = "#69ff94"
    ctx.fillText("TRENCHMARKET", 98, 68)
    ctx.shadowBlur = 0

    // Market Question
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
    ctx.font = "medium 26px sans-serif"
    const lines = wrapText(ctx, data.marketQuestion, canvas.width - 90)
    lines.forEach((line, i) => {
        ctx.fillText(line, 45, 150 + i * 38)
    })

    // Side Badge
    const badgeY = 300
    const sideColor = data.side === "YES" ? "#69ff94" : "#ff00ff"
    ctx.fillStyle = data.side === "YES" ? "rgba(105, 255, 148, 0.1)" : "rgba(255, 0, 255, 0.1)"
    ctx.strokeStyle = sideColor
    ctx.lineWidth = 1.5
    ctx.shadowBlur = 8
    ctx.shadowColor = sideColor
    roundRect(ctx, 225, badgeY, 150, 45, 12, true, true)
    ctx.shadowBlur = 0

    ctx.fillStyle = sideColor
    ctx.font = "bold 22px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(data.side.toUpperCase(), 300, badgeY + 32)

    // PnL Percent
    ctx.fillStyle = data.pnl >= 0 ? "#69ff94" : "#ff00ff"
    ctx.font = "900 110px sans-serif"
    ctx.textAlign = "center"
    ctx.shadowBlur = 25
    ctx.shadowColor = data.pnl >= 0 ? "#69ff94" : "#ff00ff"
    const pnlText = `${data.pnl >= 0 ? "+" : ""}${data.pnlPercent.toFixed(1)}%`
    ctx.fillText(pnlText, 300, 455)
    ctx.shadowBlur = 0

    // PnL SOL
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
    ctx.font = "bold 26px monospace"
    ctx.fillText(`${data.pnl >= 0 ? "Profit" : "Loss"}: ${data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(4)} SOL`, 300, 510)

    // Bottom Stats
    const statsY = 615
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"
    ctx.beginPath()
    ctx.moveTo(45, statsY - 30)
    ctx.lineTo(555, statsY - 30)
    ctx.stroke()

    // Investment
    ctx.textAlign = "left"
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
    ctx.font = "16px sans-serif"
    ctx.fillText("INVESTMENT", 45, statsY)
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "bold 27px monospace"
    ctx.fillText(`${data.amount.toFixed(4)} SOL`, 45, statsY + 38)

    // Current Value
    ctx.textAlign = "right"
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
    ctx.font = "16px sans-serif"
    ctx.fillText("CURRENT VALUE", 555, statsY)
    ctx.fillStyle = data.currentValue >= data.amount ? "#69ff94" : "#ff00ff"
    ctx.font = "bold 27px monospace"
    ctx.shadowBlur = data.currentValue >= data.amount ? 10 : 0
    ctx.shadowColor = sideColor
    ctx.fillText(`${data.currentValue.toFixed(4)} SOL`, 555, statsY + 38)
    ctx.shadowBlur = 0

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
