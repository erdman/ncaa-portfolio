'use strict';
function _stringifyGame(winner, loser, game) {
     //~ a-tag syntax: <a href="https://www.w3schools.com">Visit W3Schools.com!</a>
    return `<a href="https://www.espn.com/college-football/game?gameId=${game.id}">${(winner.teamRank < 26) ? '#' + winner.teamRank + ' ' : ''}${winner.nameRaw} ${winner.currentScore}, ${(loser.teamRank < 26) ? '#' + loser.teamRank + ' ' : ''}${loser.nameRaw} ${loser.currentScore}<\a>`;
}
function stringifyGame(game) {
    return (game.away.currentScore > game.home.currentScore) ? _stringifyGame(game.away, game.home, game) : _stringifyGame(game.home, game.away, game);
}
// win_points indexed on [WIN?][OPP FBS?]
const win_points = {true: {true: 10, false: 0}, false: {true: 0, false: -10}};
// top25_points indexed on [WIN?][RANKED BETTER?][ABS(RANK_HI - RANK_LO) unless win and oppo unranked then return 0]
const top25_points = {true:  {false: [0,5,5,5,5,6,6,6,6,6,6,6,6,6,6,8,8,8,8,8,8,8,8,8,8,10], true: [0,4,4,4,4,3,3,3,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,0]},
                      false: {false: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  true: [0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-2,-2,-2,-2,-2,-3,-3,-3,-3,-3,-3,-5,-5,-5,-5,-5]}
};
function calculateScore(hero, villain, fbs_name_set, game, new_years_six, year) {
    const heroRank = Math.min(hero.teamRank, 26);
    const villainRank = Math.min(villain.teamRank, 26);
    const VILLAIN_FBS = fbs_name_set.has(villain.nameRaw);

    const score = {win: win_points[hero.currentScore > villain.currentScore][VILLAIN_FBS],
                 blowout: VILLAIN_FBS && (hero.currentScore - villain.currentScore >= 30) ? 2 : 0,
                 shutout: VILLAIN_FBS && villain.currentScore === 0 ? 4 : 0,
                 top25:   top25_points[hero.currentScore > villain.currentScore][heroRank < villainRank][hero.currentScore > villain.currentScore && villainRank === 26 ? 0 : Math.abs(heroRank - villainRank)],
                 bowl:    (game.week === bowl_week[year] && !new_years_six.championships.has(game.id) ? 10 : 0) +
                          (new_years_six.playoffs.has(game.id) ? 6 : 0) +
                          (new_years_six.new_years_fours.has(game.id) ? 3 : 0),
                 displayString:  game.displayString,
                 week:          game.week,
                 startDate:     game.startDate,
                 win_loss_record: hero.description,
                 gameState: game.gameState
    };
    score.total = score.win + score.blowout + score.shutout + score.top25 + score.bowl;
    return score;
}

const nullGame = {win:null, blowout:null, shutout:null, top25:null, bowl:null, displayString:null, week: null, startDate:null, win_loss_record:null, gameState:null, total:null};
const weeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
const bowl_week = {2016: 16, 2017: 16, 2018: 16, 2019: 16, 2020: 17, 2021: 16, 2022: 16};
let games = [], portfolios = [];
let fbs, fbs_name_set, new_years_six = {};


function start_loaders() {
    const year =  $("#year").find(":selected").text();
    games = [], portfolios = [];
    fbs, fbs_name_set, new_years_six = {};

    let loaders = weeks.map(function (week) {
        return $.getJSON(`json/${year}/${year}${week.toString().padStart(2,'0')}.json`)
            .then(function (data) {
                games.push(...data.map(function (game) {
                    const date = new Date(game.startDate);
                    game.startDate = [date.getFullYear(), (date.getMonth() + 1).toString().padStart(2,'0'), date.getDate().toString().padStart(2,'0')].join('-');
                    game.week = parseInt(week,10);
                    return game;
                }));
            }, function () { // in case of error (ie file not found), just return as resolved ala https://stackoverflow.com/a/30219952
                return $.Deferred().resolve({}).promise();
            }
        );
    });

    loaders.push(
        $.getJSON(`json/${year}/fbs-${year}.json`)
        .then(function (data) {
            fbs = data.reduce((obj, cur) => { return { ...obj, [cur.name]: { ...cur, games:[nullGame], points: 0 } }; }, {});  //convert array to object indexed by names
            fbs_name_set = new Set(data.map(x => x.name).sort());
        })
    );

    loaders.push(
        $.getJSON(`json/${year}/new-years-six-${year}.json`)
        .then(function (data) {
            Object.keys(data).forEach(function(key) {
                new_years_six[key] = new Set(data[key]);
            });
        })
    );

    loaders.push(
        $.getJSON(`json/${year}/portfolios-${year}.json`)
        .then(function (data) {
            portfolios.push(...data.map(function (item) {
                let result = {'name': item.Name};
                delete item.Name;
                result.schools = Object.values(item).filter(x => x.length > 0);
                return result;
            }));
        })
    );

    return loaders;
}

function load_data(publish_continuation) {
    return $.when(...start_loaders()
    ).then(function () {
        const year = $('#year').find(":selected").text();
        games.sort((a, b) => a.startDate.localeCompare(b.startDate));
        console.log('when...then');
        console.log(games.length);
        console.log(games);
        console.log(fbs_name_set);
        console.log(new_years_six);
        games.forEach(function(game) {
            // parse JSON integers and trim name strings
            game.home.teamRank = parseInt(game.home.teamRank, 10);
            game.home.currentScore = parseInt(game.home.currentScore, 10);
            game.home.nameRaw = game.home.nameRaw.trim();
            game.away.teamRank = parseInt(game.away.teamRank, 10);
            game.away.currentScore = parseInt(game.away.currentScore, 10);
            game.away.nameRaw = game.away.nameRaw.trim();
            game.id = parseInt(game.id, 10);
            game.displayString = stringifyGame(game);

            if (game.gameState === 'Scheduled' || game.gameState === 'Final' || game.week === bowl_week[year]) {
                if (fbs_name_set.has(game.away.nameRaw)) {
                    // add blank bye weeks
                    while (fbs[game.away.nameRaw].games.slice(-1)[0].week < game.week - 1) {
                        fbs[game.away.nameRaw].games.push({...nullGame, week: fbs[game.away.nameRaw].games.slice(-1)[0].week + 1});
                    }

                    if (fbs[game.away.nameRaw].games.slice(-1)[0].week === 1 && game.week === 1) { // two week 1 games -> first is Week Zero
                        fbs[game.away.nameRaw].games.shift();  // remove initial element of array (nullGame)
                        fbs[game.away.nameRaw].games[0].week = 0;
                    }
                }
                if (fbs_name_set.has(game.home.nameRaw)) {
                    // add blank bye weeks
                    while (fbs[game.home.nameRaw].games.slice(-1)[0].week < game.week - 1) {
                        fbs[game.home.nameRaw].games.push({...nullGame, week: fbs[game.home.nameRaw].games.slice(-1)[0].week + 1});
                    }
                    if (fbs[game.home.nameRaw].games.slice(-1)[0].week === 1 && game.week === 1) {  // two week 1 games -> first is Week Zero
                        fbs[game.home.nameRaw].games.shift();  // remove initial element of array (nullGame)
                        fbs[game.home.nameRaw].games[0].week = 0;
                    }
                }
            }

            if (game.gameState === 'Final') {
                if (fbs_name_set.has(game.away.nameRaw)) {
                    let score = calculateScore(game.away, game.home, fbs_name_set, game, new_years_six, year);
                    score.week = Math.max(game.week, fbs[game.away.nameRaw].games.slice(-1)[0].week + 1);
                    fbs[game.away.nameRaw].games.push(score);
                    fbs[game.away.nameRaw].points += score.total;
                }

                if (fbs_name_set.has(game.home.nameRaw)) {
                    let score = calculateScore(game.home, game.away, fbs_name_set, game, new_years_six, year);
                    score.week = Math.max(game.week, fbs[game.home.nameRaw].games.slice(-1)[0].week + 1);
                    fbs[game.home.nameRaw].games.push(score);
                    fbs[game.home.nameRaw].points += score.total;
                }
            }

            // all completed games will be processed above in Final; this processes both Scheduled (all weeks) and Cancelled/Postponed week 16 bowl games
            else if (game.gameState === 'Scheduled' || game.week === bowl_week[year]) {
                const bonus = game.week === bowl_week[year] ?
                    (!new_years_six.championships.has(game.id) ? 10 : 0) +
                    (new_years_six.playoffs.has(game.id) ? 6 : 0) +
                    (new_years_six.new_years_fours.has(game.id) ? 3 : 0)
                    : null;
                if (fbs_name_set.has(game.away.nameRaw)) {
                    fbs[game.away.nameRaw].games.push({...nullGame, week: game.week, startDate: game.startDate, gameState: 'Scheduled', bowl: bonus, total: bonus, displayString: fbs_name_set.has(game.home.nameRaw) ? `<a href=#Details/${year}/${encodeURI(game.home.nameRaw)}>at ${game.home.nameRaw}</a>` : `at ${game.home.nameRaw}` });
                    fbs[game.away.nameRaw].points += bonus;
                }
                if (fbs_name_set.has(game.home.nameRaw)) {
                    fbs[game.home.nameRaw].games.push({...nullGame, week: game.week, startDate: game.startDate, gameState: 'Scheduled', bowl: bonus, total: bonus, displayString: fbs_name_set.has(game.away.nameRaw) ? `<a href=#Details/${year}/${encodeURI(game.away.nameRaw)}>${game.away.nameRaw}</a>` : `${game.away.nameRaw}` });
                    fbs[game.home.nameRaw].points += bonus;
                }
            }
        });

        portfolios.forEach(function (portfolio) {
            portfolio.score = {points: portfolio.schools.map(school => fbs[school].points).reduce((a,b) => a + b), units: portfolio.schools.map(school => fbs[school].units).reduce((a,b) => a + b)};
            portfolio.schools = portfolio.schools.map(function(school) { return {school:school, year:year, points:fbs[school].points, units:fbs[school].units};});
            portfolio.schools.sort(function(a,b) {
                const diff_points = b.points - a.points;
                const diff_units = b.units - a.units;
                const x = a.school.toLowerCase(), y = b.school.toLowerCase();
                return diff_points !== 0 ? diff_points : diff_units !== 0 ? diff_units : x < y ? -1 : x > y ? 1 : 0;
            });
        });
        portfolios.sort(function(a,b) {
            const diff_points = b.score.points - a.score.points;
            const x = a.name.toLowerCase(), y = b.name.toLowerCase();
            return diff_points !== 0 ? diff_points : x < y ? -1 : x > y ? 1 : 0;
        });
        if (portfolios.length) {
            portfolios[0].rank = 1;
            // index of the slice is zero-based, but slice starts at element [1], so portfolios[index] is the list item previous
            portfolios.slice(1).forEach((portfolio, index) => {portfolio.rank = portfolio.score.points === portfolios[index].score.points ? portfolios[index].rank : index + 2;});
        }
        globaldata[year] = {fbs, portfolios, fbs_name_set};
        publish_continuation();
    });
}

function set_details_dropdown_options(fbs_name_set) {
    console.log('repop team details dropdown');
    const old_selection = $("#details").find(":selected").text();
    // https://stackoverflow.com/questions/5805059/how-do-i-make-a-placeholder-for-a-select-box
    // https://stackoverflow.com/questions/15984430/how-to-set-a-default-prompt-when-nothing-selected-for-select-using-css/15984591
    $("#details").empty().append("<option value='' disabled selected hidden>Team Details</option>");  // not working, remains empty/blank/hidden/whitespace
    fbs_name_set.forEach(school => $("#details").append($("<option />").text(school)));  // add FBS schol names into details dropdown menu
    $("#details").val(fbs_name_set.has(old_selection) ? old_selection : "");
}

function establish_datatables() {
    const year = $('#year').find(":selected").text();
    const {fbs, portfolios, fbs_name_set} = globaldata[year];
    set_details_dropdown_options(fbs_name_set);

    $('#leaderboard_table').DataTable( {
        data: portfolios,
        columns: [
            { "data": "rank", "title": "Rank", className: "text-center" },
            { "data": "name", "title": "Name", className: "text-nowrap" },
            { "data": "schools", "title": "Portfolio", "render": li => li.map(school => `<a href=#Details/${school.year}/${encodeURI(school.school)}>${school.school}</a> (${school.points} / ${school.units})`).join(', ') },
            { "data": "score", "title": "Totals", "render": (data, type, row) => `${data.points} / ${data.units}` }
            ],
        "dom": 'lrtip',         // removes the native search input box
        scrollResize: true,
        scrollX: true,
        scrollY: 100,
        scrollCollapse: true,
        paging: false,
        lengthChange: false
    });

    $('#details_table').DataTable( {
        // no data load until dropdown is selected ... data: fbs[details_team].games,
        "language": {"emptyTable": "Select team using dropdown box to the upper right"},
        columns: [
            { "data": "week", "title": "Week" },
            { "data": "startDate", "title": "Date" },
            { "data": "displayString", "title": "Result" },
            { "data": "win_loss_record", "title": "W-L", className: "text-right" },
            { "data": "win", "title": "Win", className: "text-right" },
            { "data": "blowout", "title": "Blowout", className: "text-right" },
            { "data": "shutout", "title": "Shutout", className: "text-right" },
            { "data": "top25", "title": "Top 25", className: "text-right" },
            { "data": "bowl", "title": "Bowl", className: "text-right" },
            { "data": "total", "title": "Total", className: "text-right" }
            ],
        "rowCallback": function( row, data ) {
            if ( data.gameState === 'Scheduled' || data.gameState === null) {
                $('td:eq(0)', row).css('color', 'gray');
                $('td:eq(1)', row).css('color', 'gray');
            }
        },
        "dom": 'lrtip',         <!-- removes the native search input box-->
        scrollResize: true,
        scrollX: true,
        scrollY: 100,
        scrollCollapse: true,
        paging: false,
        lengthChange: false,
        "footerCallback": function ( row, data, start, end, display ) {

            let total = this.api()
                .column( 9, { page: 'current'} )
                .data()
                .reduce( function (a, b) {
                    return a + b;
                }, 0 );

            $( this.api().column( 9 ).footer() ).html(total);
        }
    });

    $('#summary_table').DataTable( {
        data: Object.keys(fbs).map(function (school) { return { 'name': `<a href=#Details/${year}/${encodeURI(school)}>${school}</a>`,
                                                                'conference': fbs[school].conference,
                                                                'weeklies': fbs[school].games.map(score => score.total),
                                                                'points': fbs[school].points,
                                                                'units':  fbs[school].units,
                                                                'points-per':  fbs[school].points / fbs[school].units
                                                                    };
                                                         }
                                       ),
        columns: [
            { "data": "name", "title": "Name" },
            { "data": "conference", "title": "Conference" },
            { "data": "weeklies.0", "title": "Zero", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.1", "title": "1", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.2", "title": "2", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.3", "title": "3", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.4", "title": "4", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.5", "title": "5", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.6", "title": "6", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.7", "title": "7", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.8", "title": "8", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.9", "title": "9", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.10", "title": "10", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.11", "title": "11", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.12", "title": "12", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.13", "title": "13", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.14", "title": "14", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.15", "title": "15", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.16", "title": "16", className: "text-right", "defaultContent": "" }, // normally a bowl game, but last wk reg season in 2020
            { "data": "weeklies.17", "title": "17", className: "text-right", "defaultContent": "" }, // normally NCG, but bowl games in 2020
            { "data": "weeklies.18", "title": "18", className: "text-right", "defaultContent": "", "name": "wk18", "visible": bowl_week[year] > 16 }, // NCG in 2020
            { "data": "points", "title": "Total", className: "text-right" },
            { "data": "units", "title": "Units", className: "text-right" },
            { "data": "points-per", "title": "Points / Unit", className: "text-right", render: $.fn.dataTable.render.number( ',', '.', 2 ) }
            ],
        "dom": 'lrtip',         <!-- removes the native search input box-->
        scrollResize: true,
        scrollX: true,
        scrollY: 100,
        scrollCollapse: true,
        paging: false,
        lengthChange: false
    });
}

function updateDataTable(tablename, rowdata) {
    const datatable = $(tablename).DataTable();
    datatable.clear();  // .draw();
    datatable.rows.add(rowdata);
    datatable.draw();   // columns.adjust().draw();
}

function reloadDataTable() {
    const year = $('#year').find(":selected").text();
    const {fbs, portfolios, fbs_name_set} = globaldata[year];
    // update leaderboard with new data
    updateDataTable("#leaderboard_table", portfolios);
    // update Team Summaries with new data
    updateDataTable("#summary_table", Object.keys(fbs).map(function (school) { return { 'name': `<a href=#Details/${year}/${encodeURI(school)}>${school}</a>`,
                                                            'conference': fbs[school].conference,
                                                            'weeklies': fbs[school].games.map(score => score.total),
                                                            'points': fbs[school].points,
                                                            'units':  fbs[school].units,
                                                            'points-per':  fbs[school].points / fbs[school].units
                                                                };
                                                     }
                                   )
    );
    $('#summary_table').DataTable().column('wk18:name').visible( bowl_week[year] > 16 );
    // update Team Details dropdown with new set of fbs names
    set_details_dropdown_options(fbs_name_set);
}


let globaldata = {};
window.location.hash = window.location.hash || "#Leaderboard/2022";  // sets hash to default if no hash given
$("#year").val(window.location.hash.split('/')[1] || '2022');        // sets year dropdown to value in hash or default if no year hash given
console.log('intial hash: ', window.location.hash);
let promise = load_data(establish_datatables);

$(document).ready( function () {
    // wire up the search box in template header
    $('#search').on( 'keyup', function () {
        $($.fn.dataTable.tables(true)).DataTable().search( this.value ).draw();
    } );

    // re-collapse the hamburger menu after choosing option
    $('.nav-link').on('click', function(){
        $('.navbar-collapse').collapse('hide');
    });

    // adjust and redraw each tabs table when the tab is toggled (?)
    $(document).on('shown.bs.tab', 'a[data-toggle="tab"]', function (e) {
        $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust().draw();
        const year = '#Leaderboard #Summary #Details'.includes(e.target.hash) ?  $('#year').find(":selected").text() : '';
        const details_selection = $('#details').find(":selected").text();
        const school = e.target.hash === '#Details' && details_selection !== 'Team Details' ? encodeURI(details_selection) : '';
        window.location.hash = [e.target.hash, year, school].filter(Boolean).join('/');
        console.log(e.target.hash, year, school, 'hash set');
    });

    // update data in details table when dropdown is changed
    $("#details").change(function() {
        const year = $('#year').find(":selected").text();
        const details_team = $('#details').find(":selected").text();
        const games = details_team ? globaldata[year].fbs[details_team].games : [nullGame];
        updateDataTable("#details_table", games[0] === nullGame ? games.slice(1) : games);
        window.location.hash = ['#Details', year, encodeURI(details_team)].filter(Boolean).join('/');
    });

    $("#year").change(function() {
        const year = $('#year').find(":selected").text();
        let promise = null;
        if (globaldata.hasOwnProperty(year)) {
            console.log('hasOwnProperty');
            reloadDataTable();
        } else {
            console.log('new year -- load_data()');
            promise = load_data(reloadDataTable);
        }
        // don't change the hash until data has finished loading
        return $.when(promise).then(function() {
            const [route, _, school] = window.location.hash.replace('#', '').split('/');
            window.location.hash = [route, year, school].filter(Boolean).join('/');
        });
    });

    $(window).on('hashchange', function () {
      console.log('hashchange triggered');
      let promise = null;
      const [route, year, school] = window.location.hash.replace('#', '').split('/');
      // load year data here if not already loaded
      if (year && year !== $("#year").find(":selected").text()) {
          promise = $("#year").val(year).change();
      }
      $.when(promise).then(function() {$(window).trigger(`route:${route}`, [year, decodeURI(school)]);});
    });

    $(window).on('route:Leaderboard', function (route, year, school) {
      // show view, hide others, etc.
      $('#details').hide();
      $('a[href="#Leaderboard"]').trigger('click');
    });

    $(window).on('route:Summary', function (route, year, school) {
      // show view, hide others, etc.
      $('#details').hide();
      $('a[href="#Summary"]').trigger('click');
    });

    $(window).on('route:Details', function (route, year, school) {
      // show view, hide others, etc.
      $('#details').show();
      $("#details").val(school).change();
      $('a[href="#Details"]').trigger('click');
    });

    $(window).on('route:Champions', function (route, year, school) {
      // show view, hide others, etc.
      $('#details').hide();
      $('a[href="#Champions"]').trigger('click');
      window.scrollTo(0, 0);
    });

    $(window).on('route:Rules', function (route, year, school) {
      // show view, hide others, etc.
      $('#details').hide();
      $('a[href="#Rules"]').trigger('click');
      window.scrollTo(0, 0);
    });

    // go to initial hash on page load
    $.when(promise).then(function () { console.log('triggering hashchange on page load'); $(window).trigger('hashchange'); });
} );
