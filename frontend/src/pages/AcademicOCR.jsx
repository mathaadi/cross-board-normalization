import { useState, useRef } from 'react';
import { uploadMarksheetOCR } from '../api/client';

const CONFIDENCE_COLORS = {
  high:   { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: 'rgba(16,185,129,0.2)' },
  medium: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.2)' },
  low:    { bg: 'rgba(244,63,94,0.12)',  color: '#fb7185', border: 'rgba(244,63,94,0.2)' },
};

function getConfidenceLevel(c) {
  if (c >= 0.7) return 'high';
  if (c >= 0.4) return 'medium';
  return 'low';
}

export default function AcademicOCR() {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(f.type)) {
      setError('Unsupported file type. Please upload JPG, PNG, or PDF.');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadMarksheetOCR(file);
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'OCR processing failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    stopCamera();
    if (inputRef.current) inputRef.current.value = '';
  };

  const startCamera = async () => {
    try {
      setCameraMode(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
      setCameraMode(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraMode(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const capFile = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          handleFile(capFile);
          stopCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const data = result?.data;
  const confLevel = data ? getConfidenceLevel(data.confidence || 0) : 'low';
  const confStyle = CONFIDENCE_COLORS[confLevel];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          <span style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🔬 Academic OCR Scanner
          </span>
        </h1>
        <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 2 }}>
          Upload a marksheet image · Extract student data automatically · Detect class level
        </p>
      </div>

      {/* Upload Area */}
      <div className="card animate-fade-in" style={{ padding: '24px' }}>
        <div
          style={{
            border: `2px dashed ${dragActive ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 14,
            padding: file ? '20px' : '48px 24px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            background: dragActive ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            onChange={(e) => handleFile(e.target.files?.[0])}
            style={{ display: 'none' }}
          />

          {!file ? (
            <>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📄</div>
              <p style={{ color: '#8b9cc7', fontWeight: 600, fontSize: '0.9375rem' }}>
                Drag & drop a marksheet image here
              </p>
              <p style={{ color: '#5a6a96', fontSize: '0.8125rem', marginTop: 4 }}>
                or click to browse · JPG, PNG, or PDF
              </p>
              
              <div style={{ marginTop: 20 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); startCamera(); }}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', color: '#a78bfa',
                    border: '1px solid rgba(167,139,250,0.3)',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  📷 Open Camera
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {preview && (
                <img src={preview} alt="Preview" style={{
                  maxWidth: 200, maxHeight: 140, borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  objectFit: 'contain',
                }} />
              )}
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: '#f0f4ff', fontWeight: 600, fontSize: '0.875rem' }}>{file.name}</p>
                <p style={{ color: '#5a6a96', fontSize: '0.75rem', marginTop: 2 }}>
                  {(file.size / 1024).toFixed(1)} KB · {file.type}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                    disabled={loading}
                    style={{
                      padding: '8px 20px', borderRadius: 10,
                      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                      border: 'none', color: '#fff', fontSize: '0.8125rem', fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, sans-serif', opacity: loading ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {loading ? '⏳ Processing…' : '🔍 Extract Data'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    style={{
                      padding: '8px 16px', borderRadius: 10,
                      border: '1px solid rgba(244,63,94,0.2)',
                      background: 'rgba(244,63,94,0.06)', color: '#fb7185',
                      fontSize: '0.8125rem', fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Modal Overlay */}
      {cameraMode && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(12,20,40,0.95)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 500, background: '#111c38', padding: 20, borderRadius: 16 }}>
            <h3 style={{ color: '#f0f4ff', fontWeight: 700, marginBottom: 16 }}>📷 Capture Marksheet</h3>
            
            <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', width: '100%', aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
              <button
                onClick={capturePhoto}
                style={{
                  padding: '12px 24px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer',
                }}
              >
                📸 Capture Photo
              </button>
              <button
                onClick={stopCamera}
                style={{
                  padding: '12px 24px', borderRadius: 12,
                  background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
                  color: '#fb7185', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="card animate-fade-in" style={{
          padding: '16px 20px', borderLeft: '3px solid #fb7185',
          background: 'rgba(244,63,94,0.06)',
        }}>
          <p style={{ color: '#fb7185', fontWeight: 600, fontSize: '0.8125rem' }}>⚠️ {error}</p>
        </div>
      )}

      {/* OCR Result */}
      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Status Banner */}
          <div className="card" style={{
            padding: '16px 20px',
            borderLeft: `3px solid ${result.success ? '#34d399' : '#fbbf24'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: result.success ? '#34d399' : '#fbbf24', fontWeight: 700, fontSize: '0.875rem' }}>
                {result.success ? '✅ Data extracted successfully' : '⚠️ Partial extraction — some fields may be missing'}
              </p>
              {data && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 20,
                  background: confStyle.bg, border: `1px solid ${confStyle.border}`,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: confStyle.color }} />
                  <span style={{ color: confStyle.color, fontSize: '0.6875rem', fontWeight: 700 }}>
                    Confidence: {((data.confidence || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Extracted Data Card */}
          {data && (
            <div className="card" style={{ padding: '20px' }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
                {/* Name */}
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)',
                }}>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96', letterSpacing: '0.06em' }}>Student Name</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: '#f0f4ff', marginTop: 4 }}>
                    {data.name || '—'}
                  </p>
                </div>

                {/* Class */}
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)',
                }}>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96', letterSpacing: '0.06em' }}>Detected Class</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: '#a78bfa', marginTop: 4 }}>
                    {data.class === 'unknown' ? 'Unknown' : `Class ${data.class}`}
                  </p>
                </div>

                {/* Total/Percentage */}
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)',
                }}>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', color: '#5a6a96', letterSpacing: '0.06em' }}>Total / Percentage</p>
                  <p style={{ fontSize: '1rem', fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                    {data.total ? `${data.total} marks` : '—'} {data.percentage ? ` · ${data.percentage}%` : ''}
                  </p>
                </div>
              </div>

              {/* Subjects Table */}
              {data.subjects?.length > 0 && (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#f0f4ff' }}>
                      Extracted Subjects ({data.subjects.length})
                    </h4>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Subject</th>
                        <th style={{ textAlign: 'right' }}>Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((sub, idx) => (
                        <tr key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                          <td style={{ color: '#5a6a96', fontSize: '0.75rem' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: '#f0f4ff' }}>{sub.name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#22d3ee', fontVariantNumeric: 'tabular-nums' }}>
                            {sub.marks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Warnings/Errors */}
          {result.errors?.length > 0 && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#fbbf24', marginBottom: 8 }}>⚠️ Warnings</h4>
              <ul style={{ listStyle: 'disc', paddingLeft: 20 }}>
                {result.errors.map((err, i) => (
                  <li key={i} style={{ color: '#8b9cc7', fontSize: '0.75rem', marginBottom: 4 }}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw Text Preview (collapsible) */}
          {result.raw_text_preview && (
            <details style={{ cursor: 'pointer' }}>
              <summary style={{ color: '#5a6a96', fontSize: '0.75rem', fontWeight: 600, marginBottom: 8 }}>
                🔍 View raw OCR text
              </summary>
              <div className="card" style={{ padding: '16px 20px' }}>
                <pre style={{
                  color: '#5a6a96', fontSize: '0.6875rem', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace',
                  maxHeight: 200, overflow: 'auto',
                }}>
                  {result.raw_text_preview}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
