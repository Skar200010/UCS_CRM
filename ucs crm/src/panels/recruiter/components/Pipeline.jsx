const STEPS = [
  'Contacted',
  'Screening',
  'Interview Scheduled',
  'Selected',
  'Offer Sent',
  'Rejected',
];

function ArrowRight() {
  return (
    <svg className="infographic-arrow" width="48" height="16" viewBox="0 0 48 16" fill="none">
      <path d="M2 8h40" stroke="#7B8BA5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 2l10 6-10 6" stroke="#7B8BA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg className="infographic-arrow" width="48" height="16" viewBox="0 0 48 16" fill="none">
      <path d="M46 8H6" stroke="#7B8BA5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 2L4 8l10 6" stroke="#7B8BA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="18" height="44" viewBox="0 0 18 44" fill="none">
      <path d="M9 2v36" stroke="#7B8BA5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M3 30l6 8 6-8" stroke="#7B8BA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepCard({ text }) {
  return (
    <div className="infocard">
      <div className="infocard-text">{text}</div>
    </div>
  );
}

export default function Pipeline() {
  const row1 = STEPS.slice(0, 3);
  const row2 = STEPS.slice(3).reverse();

  return (
    <div className="infographic">
      <div className="infographic-body">
        <div className="infographic-row">
          {row1.map((s, i) => (
            <span className="infographic-row-item" key={s}>
              <StepCard text={s} />
              {i < row1.length - 1 && <ArrowRight />}
            </span>
          ))}
        </div>
        <div className="infographic-down">
          <ArrowDown />
        </div>
        <div className="infographic-row">
          {row2.map((s, i) => (
            <span className="infographic-row-item" key={s}>
              {i > 0 && <ArrowLeft />}
              <StepCard text={s} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
