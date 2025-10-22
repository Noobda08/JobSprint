import RazorpayCheckoutBinder from './components/RazorpayCheckoutBinder';

export default function HomePage() {
  return (
    <div className="wrap">
      <RazorpayCheckoutBinder />
      <nav className="nav">
        <div className="logo">
          <img src="/logo.png" alt="JobSprint logo" />
        </div>
        <div className="cta">
          <a className="btn secondary" href="#how">
            How it works
          </a>
          <a className="btn primary" href="#pricing">
            ₹999 / 90 days
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="hero-grid">
          <div className="copy">
            <span className="eyebrow">Behavioral system • Built for job seekers</span>
            <h1 className="h1">You’re closer to your next offer than you think.</h1>
            <p className="sub">
              JobSprint helps you stay consistent, focused, and ready — turning your job hunt into a clear 90-day journey with
              visible progress.
            </p>
            <p className="sub">
              Because finding the right job isn’t about luck — it’s about building your own pipeline and following through until you
              close the deal.
            </p>
            <div className="hero-cta">
              <a className="btn primary" href="#pricing">
                Start Your 90-Day Sprint
              </a>
              <a className="btn secondary" href="#comfort">
                Learn How It Works
              </a>
            </div>
          </div>
          <div className="illus">
            <img
              src="/Media.png"
              alt="Illustration of a job application pipeline board with stages from applied to offer"
              loading="lazy"
            />
          </div>
        </div>
        <div className="scroll-cue">
          <a href="#comfort" style={{ textDecoration: 'none', color: 'var(--muted)' }}>
            See how it works ↓
          </a>
        </div>
      </header>

      <section className="section" id="comfort">
        <h2 className="title">
          Wherever you are in your job hunt, JobSprint helps you move forward with clarity and confidence.
        </h2>
        <p className="deck">
          Choose the path that fits your stage right now — JobSprint meets you there and keeps you moving.
        </p>
        <div className="cards">
          <article className="card">
            <h3>👣 Maybe you’re just starting.</h3>
            <p>
              <span className="hi">Start with clarity</span> — a guided 90-day roadmap so you don’t have to figure it out alone.
            </p>
          </article>
          <article className="card">
            <h3>🔄 Maybe you’ve been applying — but not hearing back.</h3>
            <p>
              <span className="hi">Bring it all together</span> — every opportunity, résumé version, note and status in one simple dashboard.
            </p>
            <p>
              <span className="hi">Then see why</span> some applications move forward and others don’t with JD↔résumé analysis and clear insights.
            </p>
          </article>
          <article className="card">
            <h3>🧭 Or maybe you’re in motion — but it’s hard to stay consistent.</h3>
            <p>
              <span className="hi">Keep steady momentum</span> — small wins, weekly goals, and progress tracking that turns effort into results.
            </p>
          </article>
        </div>
        <div className="closing">
          <strong>Bottom line:</strong> Wherever you are today, JobSprint meets you there — and helps you move forward with structure,
          calm, and confidence to find your next job faster.
        </div>
      </section>

      <section className="section" id="how">
        <h2 className="title">How JobSprint helps you stay structured and land faster</h2>
        <div className="steps">
          <div className="step">
            <div className="num">1</div>
            <div>
              <h3>Plan your 90-day sprint — the right way</h3>
              <p>
                Upload your résumé for instant insights on ATS-friendliness, formatting, and keywords. Define target roles, industries, and
                daily application goals with JobSprint’s strategy builder.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="num">2</div>
            <div>
              <h3>Manage your applications — see your progress clearly</h3>
              <p>
                All your opportunities, résumé versions, and notes in one dashboard. Track progress like a simple CRM funnel — application →
                interview → offer.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="num">3</div>
            <div>
              <h3>Learn and improve with analytics</h3>
              <p>
                We compare your résumé and answers with each JD to measure fit — see where tweaks can boost your response rate.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="num">4</div>
            <div>
              <h3>Ace your interviews with tailored preparation</h3>
              <p>
                Get strengths & gaps guidance, role-specific mock interviews, and recommendations on what to focus on next.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section pricing" id="pricing">
        <h2 className="title">Simple pricing, built for job seekers</h2>
        <p className="deck">No subscriptions. No hidden costs. One-time access for your full 90-day sprint.</p>
        <div className="price-grid">
          <div className="price-card">
            <h3>🎯 JobSprint Starter Plan</h3>
            <div className="price">
              ₹999 <span>/ 90 days</span>
            </div>
            <ul className="features">
              <li>✔ Guided 90-day roadmap</li>
              <li>✔ Résumé analysis & improvement tips</li>
              <li>✔ CRM-style application tracker</li>
              <li>✔ Analytics & progress dashboard</li>
              <li>✔ Interview preparation (practice & guidance)</li>
            </ul>
            <div className="price-cta">
              <a href="#buy" className="btn primary">
                Start Your Sprint
              </a>
            </div>
          </div>
          <div className="price-card" aria-disabled="true">
            <div className="badge">Coming soon</div>
            <h3 style={{ marginTop: '10px' }}>⚡ JobSprint AI+ Plan</h3>
            <div className="price">
              ₹1,499 <span>/ 90 days</span>
            </div>
            <ul className="features">
              <li>✔ Everything in Starter</li>
              <li>✔ Deeper JD ↔ résumé fit scoring</li>
              <li>✔ Role-specific mock interviews</li>
              <li>✔ Strengths & gaps consultation</li>
              <li>✔ Skill focus recommendations</li>
            </ul>
            <div className="price-cta">
              <a className="btn secondary" href="#waitlist">
                Join the AI+ waitlist
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="audience">
        <h2 className="title">Who JobSprint is for</h2>
        <div className="audience">
          <div>💼 Professionals seeking their next big role</div>
          <div>🎯 Working individuals planning a career switch</div>
          <div>🎓 Students preparing for placements</div>
        </div>
      </section>

      <section className="section" id="testimonials">
        <h2 className="title">What early users are saying</h2>
        <div className="tgrid">
          <div className="tcard">
            <em>“Coming soon — hear from our first batch of JobSprinters.”</em>
          </div>
          <div className="tcard">
            <em>“Real stories of discipline, structure, and success.”</em>
          </div>
          <div className="tcard">
            <em>“Your name could be here next.”</em>
          </div>
        </div>
      </section>

      <footer>
        <p>
          Built with ❤️ in India •{' '}
          <a href="#" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
            Privacy Policy
          </a>{' '}
          •{' '}
          <a href="#" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
            Terms
          </a>{' '}
          •{' '}
          <a href="#" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
            Refund Policy
          </a>
        </p>
        <p>© 2025 JobSprint. All rights reserved.</p>
      </footer>
    </div>
  );
}
