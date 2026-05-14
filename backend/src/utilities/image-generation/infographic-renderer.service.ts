import { Injectable } from '@nestjs/common';
import sharp = require('sharp');
import { GenerateInfographicDto } from './dto/generate-infographic.dto';

interface CanvasDimensions {
  width: number;
  height: number;
}

@Injectable()
export class InfographicRendererService {
  private readonly aspectRatioMap: Record<'16:9' | '9:16' | '1:1' | '4:5', CanvasDimensions> = {
    '16:9': { width: 1600, height: 900 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  };

  async renderInfographicPngBase64(payload: GenerateInfographicDto): Promise<string> {
    const aspectRatio = payload.aspectRatio || '16:9';
    const dimensions = this.aspectRatioMap[aspectRatio];
    const accentColor = payload.accentColor || '#f58634';

    let svg: string;
    switch (payload.type) {
      case 'comparison':
        svg = this.buildComparisonSvg(payload, dimensions, accentColor);
        break;
      case 'timeline':
        svg = this.buildTimelineSvg(payload, dimensions, accentColor);
        break;
      case 'fact-box':
        svg = this.buildFactBoxSvg(payload, dimensions, accentColor);
        break;
      case 'quote-highlight':
        svg = this.buildQuoteHighlightSvg(payload, dimensions, accentColor);
        break;
      case 'stat-card':
        svg = this.buildStatCardSvg(payload, dimensions, accentColor);
        break;
      case 'pie-chart':
        svg = this.buildPieChartSvg(payload, dimensions, accentColor);
        break;
      case 'carousel-slide':
        svg = this.buildCarouselSlideSvg(payload, dimensions, accentColor);
        break;
      case 'ranking':
      default:
        svg = this.buildRankingSvg(payload, dimensions, accentColor);
        break;
    }

    const pngBuffer = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    return pngBuffer.toString('base64');
  }

  private buildRankingSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const isPortrait = height > width;

    const horizontalPadding = isPortrait ? 52 : 64;
    const headerHeight = isPortrait ? 220 : 180;
    const footerHeight = 48;
    const headerCenterX = Math.floor(width / 2);
    const accentLineWidth = 220;
    const contentTop = headerHeight;
    const contentBottom = height - footerHeight;
    const contentHeight = contentBottom - contentTop;

    const rowGap = isPortrait ? 12 : 10;
    const rowHeight = Math.floor((contentHeight - rowGap * (payload.items.length - 1)) / payload.items.length);
    const rowWidth = width - horizontalPadding * 2;

    const safeTitle = this.escapeXml(payload.title.toUpperCase());
    const safeSubtitle = this.escapeXml(payload.subtitle || 'Top performers snapshot');

    let rowY = contentTop;
    const rows = [...payload.items]
      .sort((a, b) => Number(b.value) - Number(a.value))
      .map((item, index) => {
        const rank = index + 1;
        const rowBg = index % 2 === 0 ? '#131A29' : '#182237';
        const label = this.escapeXml(item.label);
        const meta = this.escapeXml(item.meta || '');
        const numValue = typeof item.value === 'number' ? item.value : Number(item.value);
        const value = `${numValue.toLocaleString()}${meta ? ` ${meta}` : ''}`;
        const safeValue = this.escapeXml(value);

        const rankBadgeWidth = isPortrait ? 92 : 84;
        const row = `
          <g transform="translate(${horizontalPadding}, ${rowY})">
            <rect x="0" y="0" width="${rowWidth}" height="${rowHeight}" rx="16" fill="${rowBg}" />
            <rect x="0" y="0" width="${rankBadgeWidth}" height="${rowHeight}" rx="16" fill="${accentColor}" />
            <text x="${Math.floor(rankBadgeWidth / 2)}" y="${Math.floor(rowHeight / 2) + 14}" text-anchor="middle" font-size="40" font-weight="800" fill="#0F172A">${rank}</text>
            <text x="${rankBadgeWidth + 26}" y="${Math.floor(rowHeight / 2) + 10}" font-size="${isPortrait ? 34 : 30}" font-weight="700" fill="#F8FAFC">${label}</text>
            <text x="${rowWidth - 24}" y="${Math.floor(rowHeight / 2) + 10}" text-anchor="end" font-size="${isPortrait ? 30 : 28}" font-weight="800" fill="#F59E0B">${safeValue}</text>
          </g>
        `;
        rowY += rowHeight + rowGap;
        return row;
      })
      .join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0B1020" />
            <stop offset="100%" stop-color="#1A2740" />
          </linearGradient>
          <radialGradient id="glow" cx="0.2" cy="0.1" r="0.9">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.32" />
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)" />
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glow)" />

        <text x="${headerCenterX}" y="${isPortrait ? 90 : 82}" text-anchor="middle" font-size="${isPortrait ? 52 : 48}" font-weight="900" fill="#FFFFFF">${safeTitle}</text>
        <text x="${headerCenterX}" y="${isPortrait ? 136 : 124}" text-anchor="middle" font-size="${isPortrait ? 26 : 24}" font-weight="500" fill="#CBD5E1">${safeSubtitle}</text>

        <rect x="${Math.floor((width - accentLineWidth) / 2)}" y="${isPortrait ? 158 : 142}" width="${accentLineWidth}" height="6" rx="3" fill="${accentColor}" />

        ${rows}

        <text x="${width - horizontalPadding}" y="${height - 16}" text-anchor="end" font-size="20" font-weight="600" fill="#94A3B8">Generated by Odin CMS</text>
      </svg>
    `;
  }

  private buildComparisonSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const horizontalPadding = 64;
    const topY = 170;
    const maxBarWidth = width - horizontalPadding * 2 - 280;
    const barHeight = 42;
    const gap = 26;
    const safeTitle = this.escapeXml(payload.title.toUpperCase());
    const safeSubtitle = this.escapeXml(payload.subtitle || 'Comparison snapshot');
    const maxValue = Math.max(...payload.items.map((item) => Number(item.value)), 1);

    const rows = payload.items
      .slice(0, 8)
      .map((item, index) => {
        const y = topY + index * (barHeight + gap);
        const numValue = typeof item.value === 'number' ? item.value : Number(item.value);
        const ratio = numValue / maxValue;
        const barWidth = Math.max(12, Math.floor(maxBarWidth * ratio));
        const label = this.escapeXml(item.label);
        const value = this.escapeXml(`${numValue.toLocaleString()}${item.meta ? ` ${item.meta}` : ''}`);
        const fill = index % 2 === 0 ? accentColor : '#38BDF8';

        return `
          <g transform="translate(${horizontalPadding}, ${y})">
            <text x="0" y="28" font-size="26" font-weight="700" fill="#E2E8F0">${label}</text>
            <rect x="220" y="4" width="${maxBarWidth}" height="${barHeight}" rx="10" fill="#1E293B" />
            <rect x="220" y="4" width="${barWidth}" height="${barHeight}" rx="10" fill="${fill}" />
            <text x="${220 + maxBarWidth + 14}" y="33" font-size="24" font-weight="700" fill="#F8FAFC">${value}</text>
          </g>
        `;
      })
      .join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#0B1020" />
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGrid)" />
        <defs>
          <pattern id="bgGrid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(148,163,184,0.12)" stroke-width="1" />
          </pattern>
        </defs>

        <text x="${Math.floor(width / 2)}" y="80" text-anchor="middle" font-size="50" font-weight="900" fill="#F8FAFC">${safeTitle}</text>
        <text x="${Math.floor(width / 2)}" y="122" text-anchor="middle" font-size="24" font-weight="500" fill="#CBD5E1">${safeSubtitle}</text>
        <rect x="${Math.floor(width / 2) - 120}" y="138" width="240" height="6" rx="3" fill="${accentColor}" />

        ${rows}
      </svg>
    `;
  }

  private buildTimelineSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const safeTitle = this.escapeXml(payload.title.toUpperCase());
    const safeSubtitle = this.escapeXml(payload.subtitle || 'Timeline');
    const startY = 210;
    const stepY = Math.floor((height - 280) / Math.max(payload.items.length - 1, 1));
    const centerX = Math.floor(width / 2);

    const points = payload.items
      .slice(0, 8)
      .map((item, index) => {
        const y = startY + index * stepY;
        const isLeft = index % 2 === 0;
        const cardWidth = Math.floor(width * 0.34);
        const cardHeight = 92;
        const cardX = isLeft ? centerX - cardWidth - 56 : centerX + 56;
        const textAnchor = isLeft ? 'end' : 'start';
        const dateLike = this.escapeXml(item.meta || `Step ${index + 1}`);
        const label = this.escapeXml(item.label);

        return `
          <g>
            <line x1="${centerX}" y1="${y}" x2="${isLeft ? centerX - 18 : centerX + 18}" y2="${y}" stroke="${accentColor}" stroke-width="4" />
            <circle cx="${centerX}" cy="${y}" r="10" fill="${accentColor}" />
            <rect x="${cardX}" y="${y - cardHeight / 2}" width="${cardWidth}" height="${cardHeight}" rx="14" fill="#172033" />
            <text x="${isLeft ? cardX + cardWidth - 20 : cardX + 20}" y="${y - 8}" text-anchor="${textAnchor}" font-size="20" font-weight="700" fill="#F8FAFC">${dateLike}</text>
            <text x="${isLeft ? cardX + cardWidth - 20 : cardX + 20}" y="${y + 22}" text-anchor="${textAnchor}" font-size="24" font-weight="700" fill="#E2E8F0">${label}</text>
          </g>
        `;
      })
      .join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#0F172A" />
        <text x="${centerX}" y="86" text-anchor="middle" font-size="50" font-weight="900" fill="#F8FAFC">${safeTitle}</text>
        <text x="${centerX}" y="126" text-anchor="middle" font-size="24" font-weight="500" fill="#CBD5E1">${safeSubtitle}</text>
        <rect x="${centerX - 120}" y="144" width="240" height="6" rx="3" fill="${accentColor}" />

        <line x1="${centerX}" y1="${startY - 26}" x2="${centerX}" y2="${height - 60}" stroke="rgba(148,163,184,0.45)" stroke-width="4" />

        ${points}
      </svg>
    `;
  }

  private buildFactBoxSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const isPortrait = height > width;
    const horizontalPadding = isPortrait ? 52 : 80;
    const headerHeight = isPortrait ? 200 : 160;
    const footerHeight = 48;
    const contentTop = headerHeight;
    const contentBottom = height - footerHeight;
    const contentHeight = contentBottom - contentTop;

    const safeTitle = this.escapeXml(payload.title?.toUpperCase() || 'QUICK FACTS');
    const safeSubtitle = this.escapeXml(payload.subtitle || '');

    const rowHeight = 70;
    const rowGap = 16;
    const totalRows = payload.items?.length || 0;
    const boxWidth = width - horizontalPadding * 2;
    const boxPadding = 32;

    let rowY = contentTop + 40;
    const rows = (payload.items || [])
      .slice(0, 10)
      .map((item, index) => {
        const label = this.escapeXml(item.label);
        const value = this.escapeXml(typeof item.value === 'string' ? item.value : String(item.value));
        const meta = item.meta ? this.escapeXml(item.meta) : '';

        const row = `
          <g transform="translate(${horizontalPadding + boxPadding}, ${rowY})">
            <text x="0" y="24" font-size="26" font-weight="600" fill="#94A3B8">${label}</text>
            <text x="${boxWidth - boxPadding * 2}" y="24" text-anchor="end" font-size="28" font-weight="700" fill="#F8FAFC">${value}${meta ? ` ${meta}` : ''}</text>
            ${index < totalRows - 1 ? `<line x1="0" y1="${rowHeight - 10}" x2="${boxWidth - boxPadding * 2}" y2="${rowHeight - 10}" stroke="#334155" stroke-width="1" stroke-dasharray="4 4" />` : ''}
          </g>
        `;
        rowY += rowHeight + rowGap;
        return row;
      })
      .join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgFactBox" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0F172A" />
            <stop offset="100%" stop-color="#1E293B" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgFactBox)" />

        <text x="${Math.floor(width / 2)}" y="${isPortrait ? 80 : 72}" text-anchor="middle" font-size="${isPortrait ? 48 : 44}" font-weight="900" fill="#F8FAFC">${safeTitle}</text>
        ${safeSubtitle ? `<text x="${Math.floor(width / 2)}" y="${isPortrait ? 120 : 110}" text-anchor="middle" font-size="22" font-weight="500" fill="#CBD5E1">${safeSubtitle}</text>` : ''}
        <rect x="${Math.floor(width / 2) - 100}" y="${isPortrait ? 140 : 128}" width="200" height="5" rx="2.5" fill="${accentColor}" />

        <rect x="${horizontalPadding}" y="${contentTop}" width="${boxWidth}" height="${contentHeight - 40}" rx="20" fill="#1E293B" stroke="${accentColor}" stroke-width="3" />

        ${rows}

        <text x="${width - horizontalPadding}" y="${height - 16}" text-anchor="end" font-size="18" font-weight="600" fill="#64748B">Generated by Odin CMS</text>
      </svg>
    `;
  }

  private buildQuoteHighlightSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const isPortrait = height > width;
    const horizontalPadding = isPortrait ? 60 : 100;
    const verticalPadding = isPortrait ? 80 : 100;

    const safeQuote = this.escapeXml(payload.quote || '');
    const safeAuthor = this.escapeXml(payload.author || '');
    const safeDesignation = this.escapeXml(payload.designation || '');

    // Word wrap the quote
    const words = safeQuote.split(' ');
    const maxCharsPerLine = isPortrait ? 25 : 45;
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      if ((currentLine + word).length > maxCharsPerLine) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    if (currentLine) lines.push(currentLine.trim());

    const lineHeight = isPortrait ? 56 : 64;
    const fontSize = isPortrait ? 42 : 48;
    const startY = Math.floor((height - lines.length * lineHeight) / 2);

    const quoteLines = lines
      .map((line, index) => {
        const y = startY + index * lineHeight;
        return `<text x="${Math.floor(width / 2)}" y="${y}" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="#F8FAFC">${line}</text>`;
      })
      .join('');

    const attributionY = startY + lines.length * lineHeight + 60;

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgQuote" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0B1120" />
            <stop offset="100%" stop-color="#1A2740" />
          </linearGradient>
          <radialGradient id="glowQuote" cx="0.5" cy="0.4" r="0.7">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.25" />
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgQuote)" />
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glowQuote)" />

        <text x="${horizontalPadding}" y="${startY - 50}" font-size="120" font-weight="900" fill="${accentColor}" opacity="0.4">"</text>
        <text x="${width - horizontalPadding}" y="${attributionY + 40}" text-anchor="end" font-size="120" font-weight="900" fill="${accentColor}" opacity="0.4">"</text>

        ${quoteLines}

        <line x1="${Math.floor(width / 2) - 80}" y1="${attributionY - 20}" x2="${Math.floor(width / 2) + 80}" y2="${attributionY - 20}" stroke="${accentColor}" stroke-width="4" />

        <text x="${Math.floor(width / 2)}" y="${attributionY + 20}" text-anchor="middle" font-size="32" font-weight="700" fill="#F59E0B">— ${safeAuthor}</text>
        ${safeDesignation ? `<text x="${Math.floor(width / 2)}" y="${attributionY + 54}" text-anchor="middle" font-size="24" font-weight="500" fill="#94A3B8">${safeDesignation}</text>` : ''}
      </svg>
    `;
  }

  private buildStatCardSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const isPortrait = height > width;

    const safeStatValue = this.escapeXml(payload.statValue || '');
    const safeStatLabel = this.escapeXml(payload.statLabel?.toUpperCase() || '');
    const safeContext = this.escapeXml(payload.context || '');

    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgStat" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0F172A" />
            <stop offset="100%" stop-color="#1E293B" />
          </linearGradient>
          <radialGradient id="glowStat" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.4" />
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgStat)" />
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glowStat)" />

        <circle cx="${centerX}" cy="${centerY}" r="${isPortrait ? 340 : 380}" fill="none" stroke="${accentColor}" stroke-width="8" opacity="0.3" />
        <circle cx="${centerX}" cy="${centerY}" r="${isPortrait ? 280 : 310}" fill="none" stroke="${accentColor}" stroke-width="4" opacity="0.2" />

        <text x="${centerX}" y="${centerY - 40}" text-anchor="middle" font-size="${isPortrait ? 110 : 130}" font-weight="900" fill="${accentColor}">${safeStatValue}</text>

        <line x1="${centerX - 200}" y1="${centerY + 20}" x2="${centerX + 200}" y2="${centerY + 20}" stroke="#475569" stroke-width="3" />

        <text x="${centerX}" y="${centerY + 80}" text-anchor="middle" font-size="${isPortrait ? 36 : 40}" font-weight="700" fill="#E2E8F0">${safeStatLabel}</text>

        ${safeContext ? `<text x="${centerX}" y="${centerY + 130}" text-anchor="middle" font-size="26" font-weight="500" fill="#94A3B8">${safeContext}</text>` : ''}

        <text x="${width - 60}" y="${height - 20}" text-anchor="end" font-size="18" font-weight="600" fill="#64748B">Generated by Odin CMS</text>
      </svg>
    `;
  }

  private buildPieChartSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const isPortrait = height > width;

    const safeTitle = this.escapeXml(payload.title?.toUpperCase() || 'DISTRIBUTION');
    const safeSubtitle = this.escapeXml(payload.subtitle || '');

    const centerX = Math.floor(width / 2);
    const centerY = isPortrait ? Math.floor(height * 0.52) : Math.floor(height * 0.54);
    const radius = isPortrait ? 240 : 280;

    const colors = [
      '#f58634', // accent (orange)
      '#38BDF8', // sky blue
      '#F59E0B', // amber
      '#10B981', // emerald
      '#8B5CF6', // violet
      '#EC4899', // pink
      '#EF4444', // red
      '#14B8A6', // teal
      '#F97316', // orange-2
      '#06B6D4', // cyan
    ];

    // Calculate total and percentages
    const items = payload.items || [];
    const total = items.reduce((sum, item) => sum + Number(item.value), 0);

    let currentAngle = -90; // Start from top
    const slices = items.map((item, index) => {
      const numValue = typeof item.value === 'number' ? item.value : Number(item.value);
      const percentage = (numValue / total) * 100;
      const angle = (numValue / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      // Calculate path for pie slice
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      // Calculate label position (middle of slice, 60% of radius)
      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const labelRadius = radius * 0.65;
      const labelX = centerX + labelRadius * Math.cos(midRad);
      const labelY = centerY + labelRadius * Math.sin(midRad);

      currentAngle = endAngle;

      return {
        path,
        color: colors[index % colors.length],
        label: this.escapeXml(item.label),
        percentage: percentage.toFixed(1),
        labelX,
        labelY,
      };
    });

    const sliceElements = slices
      .map(
        (slice) => `
        <path d="${slice.path}" fill="${slice.color}" stroke="#0B1020" stroke-width="3" />
      `
      )
      .join('');

    const labelElements = slices
      .map(
        (slice) => `
        <circle cx="${slice.labelX}" cy="${slice.labelY - 8}" r="38" fill="#000000" opacity="0.7" />
        <text x="${slice.labelX}" y="${slice.labelY}" text-anchor="middle" font-size="28" font-weight="900" fill="#FFFFFF">${slice.percentage}%</text>
      `
      )
      .join('');

    // Legend
    const legendX = isPortrait ? 60 : 80;
    const legendY = isPortrait ? height - 240 : height - 200;
    const legendItemHeight = 36;

    const legendElements = slices
      .map(
        (slice, index) => `
        <g transform="translate(${legendX}, ${legendY + index * legendItemHeight})">
          <rect x="0" y="0" width="28" height="28" rx="6" fill="${slice.color}" />
          <text x="40" y="20" font-size="22" font-weight="600" fill="#E2E8F0">${slice.label}</text>
          <text x="${width - legendX - 20}" y="20" text-anchor="end" font-size="22" font-weight="700" fill="#F8FAFC">${slice.percentage}%</text>
        </g>
      `
      )
      .join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgPie" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0B1120" />
            <stop offset="100%" stop-color="#1A2740" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.4" />
          </filter>
        </defs>

        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgPie)" />

        <text x="${centerX}" y="${isPortrait ? 76 : 70}" text-anchor="middle" font-size="${isPortrait ? 46 : 48}" font-weight="900" fill="#F8FAFC">${safeTitle}</text>
        ${safeSubtitle ? `<text x="${centerX}" y="${isPortrait ? 116 : 112}" text-anchor="middle" font-size="24" font-weight="500" fill="#CBD5E1">${safeSubtitle}</text>` : ''}
        <rect x="${centerX - 100}" y="${isPortrait ? 134 : 130}" width="200" height="5" rx="2.5" fill="${accentColor}" />

        <g filter="url(#shadow)">
          ${sliceElements}
        </g>

        ${labelElements}

        ${legendElements}

        <text x="${width - (isPortrait ? 60 : 80)}" y="${height - 16}" text-anchor="end" font-size="18" font-weight="600" fill="#64748B">Generated by Odin CMS</text>
      </svg>
    `;
  }

  private buildCarouselSlideSvg(
    payload: GenerateInfographicDto,
    dimensions: CanvasDimensions,
    accentColor: string
  ): string {
    const { width, height } = dimensions;
    const padding = 80;
    
    const safeHeadline = this.escapeXml(payload.title || '');
    const safeBody = this.escapeXml(payload.subtitle || '');
    const slideNumber = payload.statValue || '0';
    
    // Split body into lines for wrapping
    const words = safeBody.split(' ');
    const maxCharsPerLine = 40;
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      if ((currentLine + word).length > maxCharsPerLine) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    if (currentLine) lines.push(currentLine.trim());

    const bodyLineHeight = 54;
    const bodyStartY = 500;
    const bodyText = lines
      .map((line, index) => {
        const y = bodyStartY + index * bodyLineHeight;
        return `<text x="${padding}" y="${y}" font-size="36" font-weight="500" fill="#E2E8F0">${line}</text>`;
      })
      .join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgCarousel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0B1120" />
            <stop offset="100%" stop-color="#1E293B" />
          </linearGradient>
          <radialGradient id="glowCarousel" cx="0.5" cy="0.4" r="0.8">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.2" />
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgCarousel)" />
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#glowCarousel)" />

        <!-- Slide Number Badge -->
        <circle cx="${padding + 40}" cy="${padding + 40}" r="40" fill="${accentColor}" />
        <text x="${padding + 40}" y="${padding + 54}" text-anchor="middle" font-size="32" font-weight="900" fill="#0F172A">${this.escapeXml(String(slideNumber))}</text>

        <!-- Headline -->
        <g>
          ${(() => {
            const headlineWords = safeHeadline.split(' ');
            const hLines: string[] = [];
            let hLine = '';
            headlineWords.forEach(w => {
              if ((hLine + w).length > 20) {
                hLines.push(hLine.trim());
                hLine = w + ' ';
              } else {
                hLine += w + ' ';
              }
            });
            if (hLine) hLines.push(hLine.trim());
            return hLines.map((l, i) => `<text x="${padding}" y="${padding + 180 + i * 72}" font-size="64" font-weight="900" fill="#FFFFFF">${l}</text>`).join('');
          })()}
        </g>

        <!-- Body -->
        <g>
          ${bodyText}
        </g>

        <!-- Footer -->
        <rect x="${padding}" y="${height - padding - 80}" width="${width - padding * 2}" height="2" fill="#334155" />
        <text x="${padding}" y="${height - padding - 30}" font-size="24" font-weight="600" fill="#94A3B8">Odin CMS — News for Daily Life</text>
      </svg>
    `;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
