#!/usr/bin/env python3
import os
from subprocess import Popen, PIPE
from functools import wraps
import requests
import atexit
from flask import Flask, render_template, request, jsonify, send_from_directory
from markupsafe import escape
from flask_autoindex import AutoIndex
import warnings
import giphypop

from deezer_downloader.configuration import config
from deezer_downloader.web.music_backend import sched, clean_filename
from deezer_downloader.deezer import deezer_search, init_deezer_session, get_file_extension

app = Flask(__name__)
auto_index = AutoIndex(app, config["download_dirs"]["base"], add_url_rules=False)
auto_index.add_icon_rule('music.png', ext='m3u8')

warnings.filterwarnings("ignore", message="You are using the giphy public api key")
giphy = giphypop.Giphy()


def init():
    sched.run_workers(config.getint('threadpool', 'workers'))
    init_deezer_session(config['proxy']['server'],
                        config['deezer']['quality'])

    @atexit.register
    def stop_workers():
        sched.stop_workers()


init()


# user input validation
def validate_schema(*parameters_to_check):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kw):
            j = request.get_json(force=True)
            print("User request: {} with {}".format(request.path, j))
            # check if all parameters are supplied by the user
            if set(j.keys()) != set(parameters_to_check):
                return jsonify({"error": 'parameters missing, required fields: {}'.format(parameters_to_check)}), 400
            if "type" in j.keys():
                if j['type'] not in ["album", "track", "artist", "album_track", "artist_album", "artist_top"]:
                    return jsonify({"error": "type must be album, track, artist, album_track, artist_album or artist_top"}), 400
            if "music_id" in j.keys():
                if type(j['music_id']) is not int:
                    return jsonify({"error": "music_id must be a integer"}), 400
            if "add_to_playlist" in j.keys():
                if type(j['add_to_playlist']) is not bool:
                    return jsonify({"error": "add_to_playlist must be a boolean"}), 400
            if "create_zip" in j.keys():
                if type(j['create_zip']) is not bool:
                    return jsonify({"error": "create_zip must be a boolean"}), 400
            if "query" in j.keys():
                if type(j['query']) is not str:
                    return jsonify({"error": "query is not a string"}), 400
                if j['query'] == "":
                    return jsonify({"error": "query is empty"}), 400
            if "url" in j.keys():
                if (type(j['url']) is not str) or (not j['url'].startswith("http")):
                    return jsonify({"error": "url is not a url. http... only"}), 400
            if "playlist_url" in j.keys():
                if type(j['playlist_url']) is not str:
                    return jsonify({"error": "playlist_url is not a string"}), 400
                if len(j['playlist_url'].strip()) == 0:
                    return jsonify({"error": "playlist_url is empty"}), 400
            if "playlist_name" in j.keys():
                if type(j['playlist_name']) is not str:
                    return jsonify({"error": "playlist_name is not a string"}), 400
                if len(j['playlist_name'].strip()) == 0:
                    return jsonify({"error": "playlist_name is empty"}), 400
            if "user_id" in j.keys():
                if type(j['user_id']) is not str or not j['user_id'].isnumeric():
                    return jsonify({"error": "user_id must be a numeric string"}), 400
            if "artist" in j.keys():
                if type(j['artist']) is not str:
                    return jsonify({"error": "artist must be a string"}), 400
            if "title" in j.keys():
                if type(j['title']) is not str:
                    return jsonify({"error": "title must be a string"}), 400
            return f(*args, **kw)
        return wrapper
    return decorator


FRONTEND_DIST = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist')


@app.route("/")
def index():
    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()
        config_script = '<script>window.__CONFIG__={{apiRoot:"{}",useMpd:{}}}</script>'.format(
            config['http']['api_root'],
            str(config['mpd'].getboolean('use_mpd')).lower()
        )
        html = html.replace('</head>', config_script + '\n</head>')
        return html
    return render_template("index.html",
                           api_root=config["http"]["api_root"],
                           static_root=config["http"]["static_root"],
                           use_mpd=str(config['mpd'].getboolean('use_mpd')).lower())


@app.route('/assets/<path:path>')
def serve_react_assets(path):
    return send_from_directory(os.path.join(FRONTEND_DIST, 'assets'), path)


@app.route("/debug")
def show_debug():
    if "LOG_FILE" in os.environ:
        # check env LOG_FILE in Dockerfile
        # overwriting config value when using Docker
        cmd = f"tail -n 100 {os.environ['LOG_FILE']}"
    else:
        cmd = config["debug"]["command"]
    p = Popen(cmd, shell=True, stdout=PIPE)
    p.wait()
    stdout, __ = p.communicate()
    return jsonify({'debug_msg': stdout.decode()})


@app.route("/downloads/")
@app.route("/downloads/<path:path>")
def autoindex(path="."):
    # directory index - flask version (let the user download mp3/zip in the browser)
    try:
        gif = giphy.random_gif(tag="cat")
        media_url = gif.media_url
    except requests.exceptions.HTTPError:
        # the api is rate-limited. Fallback:
        media_url = "https://cataas.com/cat"

    template_context = {'gif_url': media_url}
    return auto_index.render_autoindex(path, template_context=template_context)


@app.route('/queue', methods=['GET'])
def show_queue():
    """
    shows queued tasks
    return:
        json: [ { tasks } ]
    """
    results = [
        {'id': id(task),
         'description': escape(task.description),
         #'command': task.fn_name,
         'args': escape(task.kwargs),
         'state': escape(task.state),
         'result': escape(task.result),
         'exception': escape(str(task.exception)),
         'progress': [task.progress, task.progress_maximum],
         'metadata': {k: escape(v) for k, v in task.metadata.items()} if task.metadata else {}
        } for task in sched.all_tasks
    ]
    return jsonify(results)


@app.route('/search', methods=['POST'])
def search():
    """
    searches for available music in the Deezer library
    para:
        type: track|album|album_track|artist_album|...
        query: search query
        index: (optional) pagination offset for artist_album type, default 0
    return:
        json: [ { artist, id, (title|album) } ]  or  { data: [...], total: N } for artist_album
    """
    j = request.get_json(force=True)
    if 'type' not in j or 'query' not in j:
        return jsonify({"error": "parameters missing, required fields: ('type', 'query')"}), 400
    if j['type'] not in ["album", "track", "artist", "album_track", "artist_album", "artist_top"]:
        return jsonify({"error": "type must be album, track, artist, album_track, artist_album or artist_top"}), 400
    if not isinstance(j['query'], str) or j['query'] == "":
        return jsonify({"error": "query must be a non-empty string"}), 400
    index = j.get('index', 0)
    if not isinstance(index, int) or index < 0:
        return jsonify({"error": "index must be a non-negative integer"}), 400
    results = deezer_search(j['query'], j['type'], index=index)
    return jsonify(results)


@app.route('/download', methods=['POST'])
@validate_schema("type", "music_id", "add_to_playlist", "create_zip", "artist", "title")
def deezer_download_song_or_album():
    """
    downloads a song or an album from Deezer to the dir specified in settings.py
    para:
        type: album|track
        music_id: id of the album or track (int)
        add_to_playlist: True|False (add to mpd playlist)
        create_zip: True|False (create a zip for the album)
        artist: artist name (str, for display)
        title: song or album title (str, for display)
    """
    user_input = request.get_json(force=True)
    artist = user_input.get('artist', '')
    title = user_input.get('title', '')
    if artist and title:
        desc = "{}: {} - {}".format(user_input['type'].capitalize(), artist, title)
    else:
        desc = "Downloading {}".format(user_input['type'])
    metadata = {'artist': artist, 'title': title, 'type': user_input['type']}
    if user_input['type'] == "track":
        task = sched.enqueue_task(desc, "download_deezer_song_and_queue",
                                  metadata=metadata,
                                  track_id=user_input['music_id'],
                                  add_to_playlist=user_input['add_to_playlist'])
    else:
        task = sched.enqueue_task(desc, "download_deezer_album_and_queue_and_zip",
                                  metadata=metadata,
                                  album_id=user_input['music_id'],
                                  add_to_playlist=user_input['add_to_playlist'],
                                  create_zip=user_input['create_zip'])
    return jsonify({"task_id": id(task), })


@app.route('/youtubedl', methods=['POST'])
@validate_schema("url", "add_to_playlist")
def youtubedl_download():
    """
    takes an url and tries to download it via youtuble-dl
    para:
        url: link to youtube (or something youtube-dl supports)
        add_to_playlist: True|False (add to mpd playlist)
    """
    user_input = request.get_json(force=True)
    desc = "Downloading via youtube-dl"
    task = sched.enqueue_task(desc, "download_youtubedl_and_queue",
                              video_url=user_input['url'],
                              add_to_playlist=user_input['add_to_playlist'])
    return jsonify({"task_id": id(task), })


@app.route('/playlist/deezer', methods=['POST'])
@validate_schema("playlist_url", "add_to_playlist", "create_zip")
def deezer_playlist_download():
    """
    downloads songs of a public Deezer playlist.
    A directory with the name of the playlist will be created.
    para:
        playlist_url: link to a public Deezer playlist (the id of the playlist works too)
        add_to_playlist: True|False (add to mpd playlist)
        create_zip: True|False (create a zip for the playlist)
    """
    user_input = request.get_json(force=True)
    desc = "Downloading Deezer playlist"
    task = sched.enqueue_task(desc, "download_deezer_playlist_and_queue_and_zip",
                              playlist_id=user_input['playlist_url'],
                              add_to_playlist=user_input['add_to_playlist'],
                              create_zip=user_input['create_zip'])
    return jsonify({"task_id": id(task), })


@app.route('/playlist/spotify', methods=['POST'])
@validate_schema("playlist_name", "playlist_url", "add_to_playlist", "create_zip")
def spotify_playlist_download():
    """
      1. /GET and parse the Spotify playlist (html)
      2. search every single song on Deezer. Use the first hit
      3. download the song from Deezer
    para:
        playlist_name: name of the playlist (used for the subfolder)
        playlist_url: link to Spotify playlist or just the id of it
        add_to_playlist: True|False (add to mpd playlist)
        create_zip: True|False (create a zip for the playlist)
    """
    user_input = request.get_json(force=True)
    desc = "Downloading Spotify playlist"
    task = sched.enqueue_task(desc, "download_spotify_playlist_and_queue_and_zip",
                              playlist_name=user_input['playlist_name'],
                              playlist_id=user_input['playlist_url'],
                              add_to_playlist=user_input['add_to_playlist'],
                              create_zip=user_input['create_zip'])
    return jsonify({"task_id": id(task), })


@app.route('/check_downloaded', methods=['POST'])
def check_downloaded():
    """
    checks if tracks/albums are already downloaded on disk
    para:
        list of { type: 'track'|'album', id: int|str, artist: str, title: str }
    return:
        json: { "<id>": true|false }
    """
    items = request.get_json(force=True)
    if not isinstance(items, list):
        return jsonify({"error": "expected a list"}), 400

    ext = get_file_extension()
    results = {}
    for item in items:
        item_type = item.get('type')
        artist = item.get('artist', '')
        title = item.get('title', '')
        item_id = str(item.get('id'))

        downloaded = False
        if item_type == 'album':
            album_dir = clean_filename("{} - {}".format(artist, title))
            path = os.path.join(config["download_dirs"]["albums"], album_dir)
            downloaded = os.path.isdir(path)
        elif item_type == 'track':
            for check_ext in [ext, 'flac' if ext == 'mp3' else 'mp3']:
                filename = clean_filename("{} - {}.{}".format(artist, title, check_ext))
                if os.path.exists(os.path.join(config["download_dirs"]["songs"], filename)):
                    downloaded = True
                    break
        results[item_id] = downloaded
    return jsonify(results)


@app.route('/favorites/deezer', methods=['POST'])
@validate_schema("user_id", "add_to_playlist", "create_zip")
def deezer_favorites_download():
    """
    downloads favorite songs of a Deezer user (looks like this in the brwoser:
       https://www.deezer.com/us/profile/%%user_id%%/loved)
    a subdirecotry with the name of the user_id will be created.
    para:
        user_id: deezer user_id
        add_to_playlist: True|False (add to mpd playlist)
        create_zip: True|False (create a zip for the playlist)
    """
    user_input = request.get_json(force=True)
    desc = "Downloading Deezer favorites"
    task = sched.enqueue_task(desc, "download_deezer_favorites",
                              user_id=user_input['user_id'],
                              add_to_playlist=user_input['add_to_playlist'],
                              create_zip=user_input['create_zip'])
    return jsonify({"task_id": id(task), })
