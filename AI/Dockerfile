FROM nikolaik/python-nodejs:python3.12-nodejs22-slim

WORKDIR /app

RUN npm install kordoc pdfjs-dist

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8888
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8888"]
