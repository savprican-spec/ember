import { useState } from 'react'
import { Camera, Eye, EyeOff, MapPin, Settings } from 'lucide-react'

export function ProfilePage() {
  const [visible, setVisible] = useState(true)
  const [looking, setLooking] = useState('Right now')

  return (
    <div className="profile-page">
      <header className="page-header">
        <p className="brand brand--sm">EMBER</p>
        <div className="page-header__row">
          <h1>You</h1>
          <button type="button" className="icon-btn" aria-label="Settings">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <section className="profile-hero">
        <div className="profile-hero__photo">
          <img
            src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=800&fit=crop"
            alt="Your profile"
          />
          <button type="button" className="photo-fab" aria-label="Update photo">
            <Camera size={18} />
          </button>
        </div>
        <div className="profile-hero__info">
          <h2>You, 29</h2>
          <p className="profile-hero__handle">@you.ember</p>
          <p className="profile-hero__bio">Here for heat, not hobbies. Discrete until I’m not.</p>
          <div className="tag-row">
            <span className="tag">nsfw</span>
            <span className="tag">hosting</span>
            <span className="tag">tonight</span>
          </div>
        </div>
      </section>

      <section className="profile-panel">
        <div className="toggle-row">
          <div>
            <strong>Visible on map</strong>
            <p>Others nearby can find you like Sniffies-style cruising.</p>
          </div>
          <button
            type="button"
            className={`toggle ${visible ? 'is-on' : ''}`}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <Eye size={16} /> : <EyeOff size={16} />}
            {visible ? 'On' : 'Off'}
          </button>
        </div>

        <label className="field">
          <span>Looking for</span>
          <select value={looking} onChange={(e) => setLooking(e.target.value)}>
            <option>Right now</option>
            <option>Hosting</option>
            <option>Traveling</option>
            <option>Car</option>
            <option>Tonight</option>
          </select>
        </label>

        <div className="stat-line">
          <MapPin size={16} />
          <span>San Francisco · demo location</span>
        </div>
      </section>

      <section className="profile-clips">
        <h3>Your clips</h3>
        <div className="clip-grid">
          {[
            'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=600&fit=crop',
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=600&fit=crop',
            'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=600&fit=crop',
          ].map((src) => (
            <button key={src} type="button" className="clip-tile">
              <img src={src} alt="" />
              <span>18+</span>
            </button>
          ))}
          <button type="button" className="clip-tile clip-tile--add">
            + Upload clip
          </button>
        </div>
      </section>
    </div>
  )
}
