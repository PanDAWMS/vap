"""
Core Django views for VAR project
"""
import json
from datetime import datetime
from urllib.parse import urlencode, urlparse, parse_qs
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.utils.cache import patch_response_headers
import os
import pandas as pd
from django.shortcuts import render
from django.conf import settings


def initRequest(request):
    """
    A function to check and verify request
    :param request:
    :return:
    """

    url = request.get_full_path()
    u = urlparse(url)
    query = parse_qs(u.query)
    query.pop('timestamp', None)
    try:
        u = u._replace(query=urlencode(query, True))
    except UnicodeEncodeError:
        data = {
            'errormessage': 'Error appeared while encoding URL!'
        }
        return False, render_to_response(json.dumps(data), content_type='text/html')

    ## Set default page lifetime in the http header, for the use of the front end cache
    request.session['max_age_minutes'] = 10

    ## Create a dict in session for storing request params
    requestParams = {}
    request.session['requestParams'] = requestParams

    if request.method == 'POST':
        for p in request.POST:
            pval = request.POST[p]
            pval = pval.replace('+', ' ')
            request.session['requestParams'][p.lower()] = pval
    else:
        for p in request.GET:
            pval = request.GET[p]
            pval = pval.replace('+', ' ')

            ## Here check if int or date type params can be placed

            request.session['requestParams'][p.lower()] = pval

    return True, None


def main(request):
    valid, response = initRequest(request)

    if not valid: return response

    if request.method == 'POST':

        fpath = request.POST.get("customFile")
        file_path = settings.BASE_DIR + '/datasets/' + fpath
        dataset = load_csv(file_path)
        slice = dataset.head()
        columns = dataset.columns
        # arr = [];
        # for i in slice:


        data = {
            'built': datetime.now().strftime("%H:%M:%S"),
            'dataset': dataset,
            'request': request.POST,
            'fpath': fpath,
            'new_file': True,
            'slice': slice
            }
    else:
        data = {
                'built': datetime.now().strftime("%H:%M:%S"),
                'dataset': [],
                'new_file': False
                }
    return render(request, 'main.html', data, content_type='text/html')
    # return render_to_response('main.html', data, content_type='text/html')
    # patch_response_headers(response, cache_timeout=request.session['max_age_minutes'] * 60)
    # return response

def load_csv(path_to_file, index=False, column_names=False):
    if not os.path.exists(path_to_file):
        return None

    if index:
        index = 0
    else:
        index = None

    if column_names:
        column_names = 0
    else:
        column_names = None
    return pd.read_csv(path_to_file, index_col=index, header=column_names)