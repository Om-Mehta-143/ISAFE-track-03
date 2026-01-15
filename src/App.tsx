import { useState, useEffect } from 'react';

type StepStatus = 'pending' | 'completed' | 'failed' | 'skipped';
type Verdict = 'HALT' | 'PROCEED' | null;

interface TribunalStep {
  id: string;
  label: string;
  status: StepStatus;
}

const STEPS_DATA: { id: string; label: string }[] = [
  { id: 'reasoning', label: 'Primary Reasoning' },
  { id: 'assumption', label: 'Assumption Extraction' },
  { id: 'adversarial', label: 'Adversarial Attack' },
  { id: 'evidence', label: 'Evidence Alignment' },
  { id: 'consistency', label: 'Consistency Scan' },
];

function App() {
  const [claim, setClaim] = useState('');
  const [isJudging, setIsJudging] = useState(false);
  const [steps, setSteps] = useState<TribunalStep[]>(STEPS_DATA.map((s) => ({ ...s, status: 'pending' })));
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  useEffect(() => {
    if (!isJudging) return;

    // Reset
    setSteps(STEPS_DATA.map((s) => ({ ...s, status: 'pending' })));
    setVerdict(null);
    setFailureReason(null);

    let active = true;

    const runSequence = async () => {
      // Helper to wait
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // Step 1 -> Completed (Simulated)
      await wait(800);
      if (!active) return;
      setSteps((prev) => {
        const copy = [...prev];
        copy[0] = { ...copy[0], status: 'completed' };
        return copy;
      });

      // Step 2 -> Completed (Simulated)
      await wait(800);
      if (!active) return;
      setSteps((prev) => {
        const copy = [...prev];
        copy[1] = { ...copy[1], status: 'completed' };
        return copy;
      });

      // Step 3: Call Adversarial API
      try {
        const res = await fetch('/api/adversarial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claim }),
        });

        let data;
        try {
          data = await res.json();
        } catch (e) {
          data = { verdict: 'FAIL' };
        }

        // Default to FAIL if unexpected
        const outcome = data?.verdict === 'PASS' ? 'PASS' : 'FAIL';

        if (!active) return;

        if (outcome === 'FAIL') {
          // Step 3 -> FAILED
          setSteps((prev) => {
            const copy = [...prev];
            copy[2] = { ...copy[2], status: 'failed' };
            return copy;
          });

          if (data?.failure_reason) {
            setFailureReason(data.failure_reason);
          } else {
            setFailureReason('Critical assumption collapsed under adversarial scrutiny.');
          }

          await wait(400);
          if (!active) return;

          // Steps 4 & 5 -> Skipped
          setSteps((prev) => {
            const copy = [...prev];
            copy[3] = { ...copy[3], status: 'skipped' };
            copy[4] = { ...copy[4], status: 'skipped' };
            return copy;
          });

          await wait(600);
          if (!active) return;
          setVerdict('HALT');
          setIsJudging(false);

        } else {
          // Step 3 -> Completed
          setSteps((prev) => {
            const copy = [...prev];
            copy[2] = { ...copy[2], status: 'completed' };
            return copy;
          });

          // Simulate Steps 4 & 5 for success path
          await wait(800);
          if (!active) return;
          setSteps((prev) => {
            const copy = [...prev];
            copy[3] = { ...copy[3], status: 'completed' };
            return copy;
          });

          await wait(800);
          if (!active) return;
          setSteps((prev) => {
            const copy = [...prev];
            copy[4] = { ...copy[4], status: 'completed' };
            return copy;
          });

          await wait(600);
          if (!active) return;
          setVerdict('PROCEED');
          setIsJudging(false);
        }

      } catch (err) {
        // Network error -> FAIL
        if (!active) return;
        setSteps((prev) => {
          const copy = [...prev];
          copy[2] = { ...copy[2], status: 'failed' };
          return copy;
        });
        await wait(400);
        setSteps((prev) => {
          const copy = [...prev];
          copy[3] = { ...copy[3], status: 'skipped' };
          copy[4] = { ...copy[4], status: 'skipped' };
          return copy;
        });
        await wait(600);
        setVerdict('HALT');
        setIsJudging(false);
      }
    };

    runSequence();

    return () => { active = false; };
  }, [isJudging, claim]);

  const handleStart = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && claim.trim() && !isJudging) {
      setIsJudging(true);
    }
  };

  return (
    <div className="tribunal-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      justifyContent: 'space-between',
      color: 'var(--text-active)',
      fontFamily: 'var(--font-mono)',
      border: '2px solid var(--border-color)',
      padding: '2rem',
      position: 'relative',
    }}>

      {/* Header / Input */}
      <div className="section-input" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>
          Claim Under Review
        </label>
        <input
          type="text"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          onKeyDown={handleStart}
          placeholder="ENTER CLAIM TO INITIATE JUDGEMENT..."
          disabled={isJudging || verdict === 'HALT'}
          style={{
            width: '100%',
            fontSize: '1.5rem',
            color: isJudging ? 'var(--text-dim)' : 'var(--text-active)',
            borderBottom: '1px dashed var(--border-color)',
            padding: '0.5rem 0',
          }}
          autoFocus
        />
        {verdict === 'HALT' && (
          <div style={{ marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Submission blocked pending revision.
          </div>
        )}
      </div>

      {/* Steps visualization */}
      <div className="section-process" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {steps.map((step, index) => {
          const isPending = step.status === 'pending';
          const statusText = step.status === 'completed' ? 'Completed' : (step.status === 'failed' ? 'FAILED' : (step.status === 'skipped' ? 'Skipped' : ''));
          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', opacity: isPending ? 0.3 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  marginRight: '1rem',
                  width: '2rem',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: step.status === 'failed' ? 'var(--accent-red)' : 'inherit'
                }}>
                  {index + 1}.
                </span>
                <span style={{
                  flexGrow: 1,
                  fontSize: '1.2rem',
                  textTransform: 'uppercase',
                }}>
                  {step.label}
                </span>
                <span style={{
                  fontSize: step.status === 'failed' ? '1rem' : '0.95rem',
                  width: '10rem',
                  textAlign: 'right',
                  color: step.status === 'failed' ? '#ff3b3b' : (step.status === 'completed' ? 'rgba(255,255,255,0.65)' : 'var(--text-dim)'),
                  fontWeight: step.status === 'failed' ? 900 : (step.status === 'completed' ? 500 : 600),
                  background: 'transparent',
                  padding: 0,
                  border: 'none'
                }}>
                  {step.status === 'failed' ? '✖ FAILED' : statusText}{step.status === 'skipped' ? ' — due to earlier failure' : ''}
                </span>
              </div>

              {index === 2 && step.status === 'failed' && (
                <div style={{ marginLeft: '3.25rem', borderLeft: '2px solid rgba(255,59,59,0.12)', paddingLeft: '0.75rem', color: 'var(--text-active)', fontSize: '1.12rem', fontWeight: 600 }}>
                  Failure Reason: {failureReason || 'Critical assumption collapsed under adversarial scrutiny.'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Verdict */}
      <div className="section-verdict" style={{
        marginTop: '2rem',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '2rem',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: verdict ? (verdict === 'HALT' ? 'rgba(255, 51, 51, 0.1)' : 'rgba(51, 255, 51, 0.1)') : 'transparent'
      }}>
        {verdict && (
          <h1 style={{
            fontSize: '5rem',
            fontWeight: '900',
            letterSpacing: '0.5rem',
            color: verdict === 'HALT' ? 'var(--accent-red)' : 'var(--accent-green)',
            textShadow: '0 0 20px currentColor'
          }}>
            {verdict}
          </h1>
        )}
      </div>

      {/* Footer deco */}
      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', fontSize: '0.6rem', color: 'var(--text-dim)' }}>
        SYS.TRIBUNAL.V1 // SELF-GOVERNANCE MODULE
      </div>
    </div>
  );
}

export default App;


