import sys
import os
import re
from pathlib import Path
from configparser import ConfigParser

config = None
config_path = None


def load_config(config_abs):
    global config, config_path

    if not os.path.exists(config_abs):
        print(f"Could not find config file: {config_abs}")
        sys.exit(1)

    config_path = config_abs
    config = ConfigParser()
    config.read(config_abs)

    assert list(config.keys()) == ['DEFAULT', 'mpd', 'download_dirs', 'debug', 'http', 'proxy', 'threadpool', 'deezer', 'youtubedl'], f"Validating config file failed. Check {config_abs}"

    if config['mpd'].getboolean('use_mpd'):
        if not config['mpd']['music_dir_root'].startswith(config['download_dirs']['base']):
            print("ERROR: base download dir must be a subdirectory of the mpd music_dir_root")
            sys.exit(1)

    if not Path(config['youtubedl']['command']).exists():
        print(f"ERROR: yt-dlp not found at {config['youtubedl']['command']}")
        sys.exit(1)

    proxy_server = config['proxy']['server']
    if len(proxy_server) > 0:
        if not proxy_server.startswith("https://") and \
           not proxy_server.startswith("socks5"): # there is also socks5h
            print(f"ERROR: invalid proxy server address: {config['proxy']['server']}")
            sys.exit(1)

    if "DEEZER_COOKIE_ARL" in os.environ.keys():
        config["deezer"]["cookie_arl"] = os.environ["DEEZER_COOKIE_ARL"]

    if len(config["deezer"]["cookie_arl"].strip()) == 0:
        print("WARNING: cookie_arl is empty. Set it via the web frontend.")

    if "DEEZER_QUALITY" in os.environ.keys():
        config["deezer"]["quality"] = os.environ["DEEZER_QUALITY"]
        
    if "quality" in config['deezer']:
        if config['deezer']["quality"] not in ("mp3", "flac"):
            print("ERROR: quality must be mp3 or flac in config file")
            sys.exit(1)
    else:
        print("Warning: quality not set in config file. Using mp3")
        config["deezer"]["quality"] = "mp3"


def save_arl_to_config(new_arl: str) -> None:
    if not re.fullmatch(r'[a-fA-F0-9]{192}', new_arl):
        raise ValueError("ARL must be exactly 192 hex characters")
    if "DEEZER_COOKIE_ARL" in os.environ:
        print("Warning: DEEZER_COOKIE_ARL env var is set. "
              "The env var will take precedence on next restart.")
    config['deezer']['cookie_arl'] = new_arl
    with open(config_path, 'r') as f:
        content = f.read()
    content = re.sub(r'(cookie_arl\s*=\s*).*', rf'\g<1>{new_arl}', content)
    with open(config_path, 'w') as f:
        f.write(content)


def save_download_base_to_config(new_base: str) -> None:
    new_base = new_base.strip()
    if not new_base:
        raise ValueError("Download base path cannot be empty")
    path = Path(new_base)
    if not path.is_absolute():
        raise ValueError("Download base must be an absolute path")
    config['download_dirs']['base'] = new_base
    with open(config_path, 'r') as f:
        content = f.read()
    content = re.sub(r'(base\s*=\s*).*', rf'\g<1>{new_base}', content, count=1)
    with open(config_path, 'w') as f:
        f.write(content)


def save_library_path_to_config(new_path: str) -> None:
    new_path = new_path.strip()
    if new_path:
        path = Path(new_path)
        if not path.is_absolute():
            raise ValueError("Library path must be an absolute path")
    config['download_dirs']['library_path'] = new_path
    with open(config_path, 'r') as f:
        content = f.read()
    if re.search(r'library_path\s*=', content):
        content = re.sub(r'(library_path\s*=\s*).*', rf'\g<1>{new_path}', content)
    else:
        content = re.sub(
            r'(base\s*=\s*.*)',
            rf'\1\nlibrary_path = {new_path}',
            content,
            count=1
        )
    with open(config_path, 'w') as f:
        f.write(content)


def get_library_path() -> str:
    lib = config.get('download_dirs', 'library_path', fallback='').strip()
    return lib if lib else config['download_dirs']['base']
