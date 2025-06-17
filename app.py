from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import os
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)

# Database Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'pendulum_experiments.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Experiment Model
class Experiment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    oscillations = db.Column(db.Integer, nullable=False)  # Number of oscillations (n)
    total_time = db.Column(db.Float, nullable=False)     # Total time (t)
    period = db.Column(db.Float, nullable=False)         # Period (T)
    length = db.Column(db.Float)                         # Length of pendulum (cm)
    phase_difference = db.Column(db.Float)               # Phase difference (radians)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Experiment {self.id}>'

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

@app.route('/add_data', methods=['POST'])
def add_data():
    try:
        data = request.get_json()
        
        # Create new experiment record
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
        
        # Generate CSV content
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