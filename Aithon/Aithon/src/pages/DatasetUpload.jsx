/**
 * Dataset Upload Page
 * Drag-and-drop file upload with preview table.
 */
import { useState, useCallback } from 'react';
import { datasetAPI } from '../services/api';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import { extractApiError } from '../services/errorUtils';

export default function DatasetUpload() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const parseCSVPreview = (text) => {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 0) return null;
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1, 6).map(line =>
            line.split(',').map(cell => cell.trim())
        );
        return { headers, rows, totalRows: lines.length - 1 };
    };

    const handleFile = useCallback((selectedFile) => {
        setFile(selectedFile);
        setResult(null);
        setError(null);

        if (selectedFile.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreview(parseCSVPreview(e.target.result));
            };
            reader.readAsText(selectedFile);
        } else {
            setPreview(null);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFile(dropped);
    }, [handleFile]);

    const handleUpload = async () => {
        if (!file) return;

        // Guard: aithon_token is required to talk to the FastAPI backend
        const aithonToken = localStorage.getItem('aithon_token');
        if (!aithonToken || aithonToken === 'null') {
            setError('Session expired or Aithon service unavailable. Please log out and log back in to restore your session.');
            return;
        }

        setUploading(true);
        setError(null);
        try {
            const res = await datasetAPI.upload(file);
            setResult(res.data);
            setFile(null);
            setPreview(null);
        } catch (err) {
            setError(extractApiError(err, 'Upload failed'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>Upload Dataset</h1>
                <p className="page-subtitle">Upload CSV or JSON files for processing</p>
            </div>

            {/* Drop Zone */}
            <div
                className={`drop-zone ${dragOver ? 'drop-zone--active' : ''} ${file ? 'drop-zone--has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
            >
                <input
                    id="file-input"
                    type="file"
                    accept=".csv,.json"
                    onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                    style={{ display: 'none' }}
                />
                {file ? (
                    <div className="drop-zone__file">
                        <FileSpreadsheet size={40} color="#8b5cf6" />
                        <div>
                            <p className="drop-zone__filename">{file.name}</p>
                            <p className="text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}>
                            <X size={18} />
                        </button>
                    </div>
                ) : (
                    <>
                        <Upload size={48} color="rgba(139, 92, 246, 0.5)" />
                        <p style={{ marginTop: 16, fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>
                            Drag & drop a file here, or click to browse
                        </p>
                        <p className="text-muted">Supports CSV and JSON files up to 100MB</p>
                    </>
                )}
            </div>

            {/* Preview Table */}
            {preview && (
                <div className="card" style={{ marginTop: '24px' }}>
                    <h3>Preview ({preview.totalRows} rows)</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {preview.headers.map((h, i) => <th key={i}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.rows.map((row, i) => (
                                    <tr key={i}>
                                        {row.map((cell, j) => <td key={j}>{cell || <span className="text-muted">—</span>}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {preview.totalRows > 5 && (
                        <p className="text-muted" style={{ padding: '12px', textAlign: 'center' }}>
                            Showing 5 of {preview.totalRows} rows
                        </p>
                    )}
                </div>
            )}

            {/* Upload Button */}
            {file && (
                <button
                    className="btn btn--primary"
                    onClick={handleUpload}
                    disabled={uploading}
                    style={{ marginTop: 24 }}
                >
                    {uploading ? (
                        <><span className="spinner spinner--small" /> Uploading...</>
                    ) : (
                        <><Upload size={18} /> Upload Dataset</>
                    )}
                </button>
            )}

            {/* Success */}
            {result && (
                <div className="alert alert--success" style={{ marginTop: 24 }}>
                    <CheckCircle size={20} />
                    <div>
                        <strong>Upload successful!</strong>
                        <p>Dataset "{result.name}" — {result.row_count} rows, {result.column_count} columns</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="alert alert--error" style={{ marginTop: 24 }}>
                    <AlertCircle size={20} />
                    <div>
                        <strong>Upload failed</strong>
                        <p>{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
