export function AnalysisWorkspaceEmptyState() {
  return (
    <section className="analysis-empty-panel">
      <div className="analysis-empty-panel__card">
        <span className="analysis-empty-panel__eyebrow">분석 준비</span>
        <h3 className="analysis-empty-panel__title">문서 맵이 아직 없습니다.</h3>
        <p className="analysis-empty-panel__description">
          전체 분석을 실행하면 문서 카드와 연결 관계를 이곳에서 바로 볼 수 있습니다.
        </p>
      </div>
    </section>
  );
}
