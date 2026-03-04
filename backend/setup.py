from setuptools import setup, find_packages

setup(
    name="daikin-forecast-api",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "flask",
        "flask-cors",
        "flask-jwt-extended",
        "python-dotenv",
        "pandas",
        "numpy",
        "openpyxl",
        "werkzeug",
    ],
)