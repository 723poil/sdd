import { useEffect, useId, useRef, useState } from 'react';

interface MermaidDiagramProps {
  code: string;
}

interface MermaidRenderResult {
  bindFunctions?: (element: Element) => void;
  svg: string;
}

interface MermaidApi {
  initialize(config: ReturnType<typeof createMermaidConfig>): void;
  render(id: string, code: string): Promise<MermaidRenderResult>;
}

let mermaidModulePromise: Promise<MermaidApi> | null = null;

export function MermaidDiagram(props: MermaidDiagramProps) {
  const diagramId = useId().replaceAll(':', '-');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bindFunctionsRef = useRef<((element: Element) => void) | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const mermaid = await loadMermaid();

        mermaid.initialize(createMermaidConfig());

        const { svg, bindFunctions } = await mermaid.render(`mermaid-${diagramId}`, props.code);
        if (cancelled) {
          return;
        }

        bindFunctionsRef.current = bindFunctions;
        setSvgMarkup(svg);
        setErrorMessage(null);
      } catch {
        if (cancelled) {
          return;
        }

        bindFunctionsRef.current = undefined;
        setSvgMarkup(null);
        setErrorMessage('Mermaid 다이어그램을 렌더링하지 못했습니다.');
      }
    };

    setSvgMarkup(null);
    setErrorMessage(null);
    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [diagramId, props.code]);

  useEffect(() => {
    if (!svgMarkup || !containerRef.current || !bindFunctionsRef.current) {
      return;
    }

    bindFunctionsRef.current(containerRef.current);
  }, [svgMarkup]);

  return (
    <div className="markdown-document__mermaid-shell">
      <div className="markdown-document__mermaid">
        {svgMarkup ? (
          <div
            className="markdown-document__mermaid-canvas"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
            ref={containerRef}
          />
        ) : (
          <p className="markdown-document__mermaid-placeholder">다이어그램 렌더링 중...</p>
        )}
      </div>

      {errorMessage ? (
        <div className="markdown-document__mermaid-error">
          <p>{errorMessage}</p>
          <pre>
            <code>{props.code}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}

async function loadMermaid() {
  mermaidModulePromise ??= import('mermaid').then((mermaidModule) => {
    return mermaidModule.default as MermaidApi;
  });

  return mermaidModulePromise;
}

function createMermaidConfig() {
  const rootStyles = window.getComputedStyle(document.documentElement);
  const textPrimary = rootStyles.getPropertyValue('--text-primary').trim() || '#151d29';
  const textSecondary = rootStyles.getPropertyValue('--text-secondary').trim() || '#5d697a';
  const border = rootStyles.getPropertyValue('--border-strong').trim() || 'rgba(15, 23, 42, 0.13)';
  const panel = rootStyles.getPropertyValue('--bg-panel').trim() || '#ffffff';
  const panelSoft = rootStyles.getPropertyValue('--bg-panel-soft').trim() || '#f3f5f7';
  const background = rootStyles.getPropertyValue('--bg').trim() || '#fafbfc';
  const fontFamily =
    rootStyles.getPropertyValue('font-family').trim() ||
    "'IBM Plex Sans', 'Pretendard', 'Segoe UI', sans-serif";

  return {
    startOnLoad: false,
    securityLevel: 'strict' as const,
    theme: 'base' as const,
    fontFamily,
    flowchart: {
      htmlLabels: false,
      curve: 'basis' as const,
      useMaxWidth: false,
    },
    themeVariables: {
      background: 'transparent',
      fontFamily,
      primaryColor: panel,
      primaryTextColor: textPrimary,
      primaryBorderColor: border,
      lineColor: textSecondary,
      textColor: textPrimary,
      mainBkg: panel,
      secondBkg: panelSoft,
      tertiaryColor: panelSoft,
      clusterBkg: panelSoft,
      clusterBorder: border,
      edgeLabelBackground: background,
      nodeBorder: border,
    },
  };
}
