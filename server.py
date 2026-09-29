# -*- coding: utf-8 -*-
import os
from flask import Flask, send_from_directory

from routes.token import bp as token_bp
from routes.groups import bp as groups_bp
from routes.reference import bp as reference_bp
from routes.schedule import bp as schedule_bp
from routes.lessons import bp as lessons_bp
from routes.publish import bp as publish_bp
from routes.templates import bp as templates_bp
from routes.group_settings import bp as group_settings_bp
from routes.reports import bp as reports_bp

APP_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)


@app.route("/")
def index():
    return send_from_directory(APP_DIR, "index.html")


app.register_blueprint(token_bp)
app.register_blueprint(groups_bp)
app.register_blueprint(reference_bp)
app.register_blueprint(schedule_bp)
app.register_blueprint(lessons_bp)
app.register_blueprint(publish_bp)
app.register_blueprint(templates_bp)
app.register_blueprint(group_settings_bp)
app.register_blueprint(reports_bp)


if __name__ == "__main__":
    print("Открой в браузере: http://localhost:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
