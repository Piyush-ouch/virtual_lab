from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import os
from datetime import datetime
import google.generativeai as genai
from werkzeug.utils import secure_filename
import base64
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import PyPDF2
import replicate


# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

@app.route('/generate_image', methods=['POST'])
def generate_image():
    prompt = request.json.get('prompt')
    if not prompt:
        return jsonify({"status": "error", "message": "No prompt provided"}), 400

    # Call Replicate Stable Diffusion
    output = replicate.run(
        "stability-ai/stable-diffusion:latest",
        input={"prompt": prompt}
    )
    # output is a list of image URLs
    return jsonify({"status": "success", "image_url": output[0]})

# Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'pendulum_experiments.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(basedir, 'uploads')
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'pdf', 'txt'}
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'default-secret-key')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5 MB file size limit

# Initialize extensions
db = SQLAlchemy(app)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Configure Gemini API securely
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-1.5-flash')

# Experiment Model
class Experiment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    oscillations = db.Column(db.Integer, nullable=False)
    total_time = db.Column(db.Float, nullable=False)
    period = db.Column(db.Float, nullable=False)
    length = db.Column(db.Float)
    phase_difference = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Experiment {self.id}>'

# Create upload folder if not exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Create database tables
with app.app_context():
    db.create_all()

# Application Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/phytheory')
def phytheory():
    return render_template('phytheory.html')

@app.route('/quiz')
def quiz():
    return render_template('quiz.html')

@app.route('/viziapi-interface')
def viziapi_interface():
    return render_template('viziapi.html')

@app.route('/viziapi', methods=['POST'])
@limiter.limit("10 per minute")
def viziapi():
    try:
        text_input = request.form.get('text_input', '')
        file = request.files.get('file_input')
        file_path = None
        file_content = None
        input_type = "text"
        mime_type = None

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)

            ext = filename.lower().rsplit('.', 1)[1]
            if ext in ['png', 'jpg', 'jpeg']:
                with open(file_path, "rb") as image_file:
                    file_content = image_file.read()
                input_type = "image"
                # Set correct mime type
                if ext == "png":
                    mime_type = "image/png"
                else:
                    mime_type = "image/jpeg"
            elif ext == 'pdf':
                try:
                    with open(file_path, "rb") as pdf_file:
                        reader = PyPDF2.PdfReader(pdf_file)
                        file_content = ""
                        for page in reader.pages:
                            file_content += page.extract_text() or ""
                    input_type = "pdf"
                except Exception as pdf_err:
                    file_content = f"Could not extract text from PDF: {pdf_err}"
                    input_type = "pdf"
            else:  # txt files
                with open(file_path, 'r', encoding='utf-8') as f:
                    file_content = f.read()
                input_type = "text"

        # Prepare prompt based on input type
        if input_type == "image" and file_content:
            prompt_parts = [
                {"text": (
                    "You are an expert assistant. Please analyze the following image and:\n"
                    "1. Identify the main content or subject.\n"
                    "2. Summarize any visible data, text, or diagrams.\n"
                    "3. Suggest possible context or use cases.\n"
                    "4. Answer any user question or context provided below.\n"
                    f"User context: {text_input}"
                )},
                {"inline_data": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(file_content).decode()
                }}
            ]
            response = model.generate_content(contents=prompt_parts)
        elif input_type == "pdf":
            prompt_parts = [
                "You are an expert assistant. Please analyze the following document and:",
                "1. Summarize its main purpose and key points.",
                "2. Identify the domain or subject (e.g., resume, research, invoice, manual, etc.).",
                "3. Extract important information, data, or insights relevant to the document type.",
                "4. Suggest improvements or next steps if appropriate.",
                "5. Answer any user question or context provided below.",
                "\nDocument content:", file_content,
                "\nUser context:", text_input
            ]
            response = model.generate_content(prompt_parts)
        elif input_type == "text" and file_content:
            prompt_parts = [
                "You are an expert assistant. Please analyze the following text document and:",
                "1. Summarize its main content and purpose.",
                "2. Extract key information or data.",
                "3. Suggest improvements or next steps if appropriate.",
                "4. Answer any user question or context provided below.",
                "\nDocument content:", file_content,
                "\nUser context:", text_input
            ]
            response = model.generate_content(prompt_parts)
        else:
            prompt_parts = [
                "You are an expert assistant. Please:",
                "1. Answer the user's question clearly and concisely.",
                "2. Provide relevant information, examples, or suggestions.",
                "3. If the user asks for a table, ALWAYS reply with a valid HTML <table> element (not Markdown), and do NOT wrap it in code blocks.",
                "\nUser question:", text_input
            ]
            response = model.generate_content(prompt_parts)

        # Clean up uploaded file
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({
            "status": "success",
            "response": response.text,
            "input_type": input_type
        })

    except Exception as e:
        if 'file_path' in locals() and file_path and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/add_data', methods=['POST'])
def add_data():
    try:
        data = request.get_json()
        if not all(key in data for key in ['n', 't', 'T']):
            return jsonify({"status": "error", "message": "Missing required fields"}), 400

        experiment = Experiment(
            oscillations=int(data['n']),
            total_time=float(data['t']),
            period=float(data['T']),
            length=float(data.get('length', 0)),
            phase_difference=float(data.get('phase_difference', 0))
        )

        db.session.add(experiment)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Experiment data saved successfully",
            "experiment_id": experiment.id
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400

@app.route('/get_average', methods=['GET'])
def get_average():
    try:
        experiments = Experiment.query.all()
        if not experiments:
            return jsonify({
                "average": 0,
                "count": 0,
                "status": "success"
            })

        total_period = sum(exp.period for exp in experiments)
        average_period = total_period / len(experiments)

        return jsonify({
            "average": average_period,
            "count": len(experiments),
            "status": "success"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/get_experiments', methods=['GET'])
def get_experiments():
    try:
        experiments = Experiment.query.order_by(Experiment.created_at.desc()).all()
        experiments_list = [{
            "id": exp.id,
            "oscillations": exp.oscillations,
            "total_time": exp.total_time,
            "period": exp.period,
            "length": exp.length,
            "phase_difference": exp.phase_difference,
            "created_at": exp.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for exp in experiments]

        return jsonify({
            "status": "success",
            "data": experiments_list
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/delete_experiment/<int:exp_id>', methods=['DELETE'])
def delete_experiment(exp_id):
    try:
        experiment = Experiment.query.get_or_404(exp_id)
        db.session.delete(experiment)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Experiment {exp_id} deleted successfully"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/download_csv', methods=['GET'])
def download_csv():
    try:
        experiments = Experiment.query.order_by(Experiment.created_at.desc()).all()
        csv_content = "ID,Oscillations,Total Time,Period,Length,Phase Difference,Date\n"
        for exp in experiments:
            csv_content += (f"{exp.id},{exp.oscillations},{exp.total_time},{exp.period},"
                            f"{exp.length},{exp.phase_difference},{exp.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n")

        return csv_content, 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename=pendulum_experiments.csv'
        }
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/check_data')
def check_data():
    """Endpoint to quickly check stored data"""
    try:
        experiments = Experiment.query.all()
        return jsonify([{
            'id': e.id,
            'length': e.length,
            'oscillations': e.oscillations,
            'total_time': e.total_time,
            'period': e.period,
            'created_at': e.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for e in experiments])
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    app.run(debug=True, host='0.0.0.0', port=port)