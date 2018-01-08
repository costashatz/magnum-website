var projects = [['mosra/corrade', 'master'],
                ['mosra/magnum', 'master'],
                ['mosra/magnum-plugins', 'master'],
                ['mosra/magnum-extras', 'master'],
                ['mosra/magnum-integration', 'master'],
                ['mosra/magnum-examples', 'master'],
                ['mosra/magnum-examples', 'ports'],
                ['mosra/magnum-bootstrap', 'master']];
var latestTravisJobs = [];
var travisDone = 0;
var travisJobIdRe = /JOBID=([a-zA-Z0-9-]+)/

var appveyorDone = 0;
var appveyorJobIdRe = /APPVEYOR_JOB_NAME=([a-zA-Z0-9-]+)/

/* Ability to override the projects via query string */
if(location.search) {
    let params = new URLSearchParams(location.search);
    projects = []
    for(let p of params) projects.push(p);
}

function timeDiff(before, now) {
    var diff = now.getTime() - before.getTime();

    /* Try days first. If less than two days, try hours. If less than two
       hours, try minutes. If less than a minute, say "now". */
    if(diff/(24*60*60*1000) > 2)
        return Math.round(diff/(24*60*60*1000)) + "d";
    else if(diff/(60*60*1000) > 2)
        return Math.round(diff/(60*60*1000)) + "h";
    else if(diff/(60*1000) > 1)
        return Math.round(diff/(60*1000)) + "m";
    else
        return "now";
}

function fetchTravisJobStatus(latestJobs) {
    var req = window.XDomainRequest ? new XDomainRequest() : new XMLHttpRequest();
    if(!req) return;

    req.open("GET", 'https://api.travis-ci.org/jobs?ids[]=' + latestJobs.join('&ids[]='), true);
    req.setRequestHeader("Accept", "application/vnd.travis-ci.2+json");
    req.responseType = 'json';
    req.onreadystatechange = function() {
        if(req.readyState != 4) return;

        //console.log(req.response);

        var now = new Date(Date.now());
        var jobs = req.response['jobs'];
        for(var i = 0; i != jobs.length; ++i) {
            var match = jobs[i]['config']['env'].match(travisJobIdRe);
            if(!match) continue;

            /* ID is combined repository name (w/o author) and the job ID from
               environment */
            var repo = jobs[i]['repository_slug'];
            var id = repo.substr(repo.indexOf('/') + 1) + "-" + match[1];
            var elem = document.getElementById(id);
            if(!elem) {
                console.log('Unknown Travis job ID', id);
                continue;
            }

            var type;
            var status;
            var ageField;
            if(jobs[i]['state'] == 'passed') {
                type = 'm-success';
                status = '✔';
                ageField = 'finished_at';
            } else if(jobs[i]['state'] == 'started') {
                type = 'm-warning';
                status = '↺';
                ageField = 'started_at';
            } else if(jobs[i]['state'] == 'canceled') {
                type = 'm-dim';
                status = '∅';
                ageField = 'finished_at';
            } else if(jobs[i]['state'] == 'received' ||
                      jobs[i]['state'] == 'created' ||
                      jobs[i]['state'] == 'queued') {
                type = 'm-info';
                status = '…';
                ageField = '';
            } else if(jobs[i]['state'] == 'errored' ||
                      jobs[i]['state'] == 'failed') {
                type = 'm-danger';
                status = '✘';
                ageField = 'finished_at';
            } else {
                type = 'm-default';
                status = jobs[i]['state'];
                ageField = 'started_at';
            }

            var age;
            var title;
            if(ageField) {
                age = timeDiff(new Date(Date.parse(jobs[i][ageField])), now);
                title = jobs[i]['state'] + ' @ ' + jobs[i][ageField];
            } else {
                age = '';
                title = jobs[i]['state'];
            }

            elem.innerHTML = '<a href="https://travis-ci.org/' + repo + '/jobs/' + jobs[i]['id'] + '" title="' + title + '">' + status + '<br />' + age + '</a>';
            elem.className = type;
        }
    };
    req.send();
}

function fetchLatestTravisJobs(project, branch) {
    var req = window.XDomainRequest ? new XDomainRequest() : new XMLHttpRequest();
    if(!req) return;

    req.open("GET", 'https://api.travis-ci.org/repos/' + project + '/branches/' + branch, true);
    req.setRequestHeader("Accept", "application/vnd.travis-ci.2+json");
    req.responseType = 'json';
    req.onreadystatechange = function() {
        if(req.readyState != 4) return;

        latestTravisJobs = latestTravisJobs.concat(req.response['branch']['job_ids']);
        if(++travisDone == projects.length)
            fetchTravisJobStatus(latestTravisJobs);
    };
    req.send();
}

function fetchLatestAppveyorJobs(project, branch) {
    var req = window.XDomainRequest ? new XDomainRequest() : new XMLHttpRequest();
    if(!req) return;

    req.open("GET", 'https://ci.appveyor.com/api/projects/' + project + '/branch/' + branch, true);
    req.responseType = 'json';
    req.onreadystatechange = function() {
        if(req.readyState != 4) return;

        //console.log(req.response);

        var now = new Date(Date.now());
        var repo = req.response['project']['repositoryName'];
        repo = repo.substr(repo.indexOf('/') + 1);
        var jobs = req.response['build']['jobs'];
        for(var i = 0; i != jobs.length; ++i) {
            var match = jobs[i]['name'].match(appveyorJobIdRe);
            if(!match) continue;

            /* ID is combined repository name (w/o author) and the job ID from
               environment */
            var id = repo + "-" + match[1];
            var elem = document.getElementById(id);
            if(!elem) {
                console.log('Unknown AppVeyor job ID', id);
                continue;
            }

            var type;
            var status;
            var ageField;
            if(jobs[i]['status'] == 'success') {
                type = 'm-success';
                status = '✔';
                ageField = 'finished';
            } else if(jobs[i]['status'] == 'queued') {
                type = 'm-info';
                status = '…';
                ageField = 'started';
            } else if(jobs[i]['status'] == 'running') {
                type = 'm-warning';
                status = '↺';
                ageField = 'started';
            } else if(jobs[i]['status'] == 'failed') {
                type = 'm-danger';
                status = '✘';
                ageField = 'finished';
            } else if(jobs[i]['status'] == 'cancelled') {
                type = 'm-dim';
                status = '∅';
                ageField = 'finished';
            } else {
                type = 'm-default';
                status = jobs[i]['status'];
                ageField = 'started';
            }

            var age = timeDiff(new Date(Date.parse(jobs[i][ageField])), now);

            elem.innerHTML = '<a href="https://ci.appveyor.com/project/' + repo + '/build/' + req.response['build']['version'] + '/job/' + jobs[i]['jobId'] + '" title="' + jobs[i]['status'] + ' @ ' + jobs[i][ageField] + '">' + status + '<br />' + age + '</a>';
            elem.className = type;
        }
    };
    req.send();
}

function fetchLatestCoverallsJobs(project, branch) {
    var req = window.XDomainRequest ? new XDomainRequest() : new XMLHttpRequest();
    if(!req) return;

    req.open("GET", 'https://coveralls.io/github/' + project + '.json?branch=' + branch, true);
    req.responseType = 'json';
    req.onreadystatechange = function() {
        if(req.readyState != 4) return;

        //console.log(req.response);

        var repo = req.response['repo_name'];
        var id = 'coverage-' + repo;
        var elem = document.getElementById(id);

        var coverage = Math.round(req.response['covered_percent']);
        var type;
        if(coverage > 95) type = 'm-success';
        else if(coverage > 80) type = 'm-warning';
        else type = 'm-danger';

        var age = timeDiff(new Date(Date.parse(req.response['created_at'])), new Date(Date.now()));

        elem.innerHTML = '<a href="https://coveralls.io/github/' + repo + '" title="@ ' + req.response['created_at'] + '">' + Math.round(req.response['covered_percent']) + '%<br />' + age + '</a>';
        elem.className = type;
    };
    req.send();
}

for(var i = 0; i != projects.length; ++i) {
    fetchLatestCoverallsJobs(projects[i][0], projects[i][1]);
    fetchLatestTravisJobs(projects[i][0], projects[i][1]);
    fetchLatestAppveyorJobs(projects[i][0], projects[i][1]);
}
