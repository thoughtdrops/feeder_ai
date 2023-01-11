from flask import Flask, request, render_template
import openai
import re
from youtube_transcript_api import YouTubeTranscriptApi as yta
import os
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)

# # Replace YOUR_API_KEY with your actual API key
openai.api_key = os.getenv("OPENAI_API_KEY")
print(os.getenv("OPENAI_API_KEY"))

def summarize_transcript(transcript,points):
    
    # Use the text-embedding-ada-002 model to summarize the transcript
    all_text = ""
    for trans in transcript:
        if len(all_text)<=2049:
            all_text = all_text + " " + trans["text"]
    
    print(all_text)
    prompt = "Summarize this text for me in a list "+str(points)+" points with /n after every point: "+str(all_text)
    model_engine = "text-curie-001"
    summary = openai.Completion.create(model=model_engine, prompt=prompt, max_tokens=1024,  temperature=1)
    summary_text = summary.choices[0].text
    print(summary_text)
    return summary_text


@app.route('/', methods=['GET', 'POST'])
def home():
    summary = ""
    transcript = []

    if request.method == 'POST':
       
        # Retrieve the URL from the form input
        url = request.form['url']
        first_split = url.split("v=")
        second_split = first_split[1].split("&")
        data = yta.get_transcript(second_split[0])
        transcript = data
        # Use the YouTube API to retrieve the transcript of the video
        summary = summarize_transcript(data,request.form['points'])
        final_summary = summary.split('\n')
        return render_template('index.html', summary=final_summary,transcript=transcript)

    return render_template('index.html',summary=summary,transcript=transcript)





if __name__ == '__main__':
    app.run(debug=True)




    







