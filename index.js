'use strict';
function _stringifyGame(winner, loser, game) {
     //~ a-tag syntax: <a href="https://www.w3schools.com">Visit W3Schools.com!</a>
    return `<a href="https://www.ncaa.com${game.url}">${(winner.teamRank > 0) ? '#' + winner.teamRank + ' ' : ''}${winner.nameRaw} ${winner.currentScore}, ${(loser.teamRank > 0) ? '#' + loser.teamRank + ' ' : ''}${loser.nameRaw} ${loser.currentScore}<\a>`;
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
function calculateScore(hero, villain, fbs_name_set, game, new_years_six) {
    let heroRank = hero.teamRank > 0 ? hero.teamRank : 26;
    let villainRank = villain.teamRank > 0 ? villain.teamRank : 26;
    let VILLAIN_FBS = fbs_name_set.has(villain.nameRaw);
    let score = {win: win_points[hero.currentScore > villain.currentScore][VILLAIN_FBS],
                 blowout: VILLAIN_FBS && (hero.currentScore - villain.currentScore >= 30) ? 2 : 0,
                 shutout: VILLAIN_FBS && villain.currentScore === 0 ? 4 : 0,
                 top25:   top25_points[hero.currentScore > villain.currentScore][heroRank < villainRank][hero.currentScore > villain.currentScore && villainRank === 26 ? 0 : Math.abs(heroRank - villainRank)],
                 bowl:    (game.week === 16 && !new_years_six.championships.has(game.id) ? 10 : 0) +
                          (new_years_six.playoffs.has(game.id) ? 6 : 0) +
                          (new_years_six.new_years_fours.has(game.id) ? 3 : 0),
                 score_string:  game.score_string,
                 week:          game.week,
                 startDate:     game.startDate,
                 win_loss_record: hero.description
    };
    score.total = score.win + score.blowout + score.shutout + score.top25 + score.bowl;
    return score;
}

function displaySchool(school) {
    return `${school.name} (${school.points} / ${school.units})`
}


let games = [], portfolios = [];
const weeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
const year = 2017;

let loaders = weeks.map(function (week) {
    return $.getJSON(`json/${year}/${year}${week.toString().padStart(2,'0')}.json`)
        .then(function (data) {
            games.push(...data.map(function (game) {
                game.week = week;
                return game;
            }));
        }, function () { // in case of error (ie file not found), just return as resolved ala https://stackoverflow.com/a/30219952
            return $.Deferred().resolve({}).promise();
        }
    );
});


let fbs, fbs_name_set, new_years_six = {};

loaders.push(
    $.getJSON('json/fbs-2017.json')
    .then(function (data) {
        fbs = data.reduce((obj, cur) => { return { ...obj, [cur.name]: { ...cur, games:[], points: 0 } }; }, {});  //convert array to object indexed by names
        fbs_name_set = new Set(data.map(x => x.name));
        fbs_name_set.forEach(school => $("#details").append($("<option />").text(school)));  // add FBS schol names into details dropdown menu
    })
);

loaders.push(
    $.getJSON('json/new-years-six.json')
    .then(function (data) {
        Object.keys(data).forEach(function(key) {
            new_years_six[key] = new Set(data[key]);
        });
    })
);

loaders.push(
    $.getJSON('json/portfolios-2017.json')
    .then(function (data) {
        portfolios.push(...data.map(function (item) {
            let result = {'name': item.Name};
            delete item.Name;
            result.schools = Object.values(item).filter(x => x.length > 0);
            return result;
        }));
    })
);


$.when(...loaders
).then(function () {
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
        game.score_string = stringifyGame(game);

        if (game.gameState === 'final') {
            if (fbs_name_set.has(game.away.nameRaw)) {
                let score = calculateScore(game.away, game.home, fbs_name_set, game, new_years_six);
                fbs[game.away.nameRaw].games.push(score);
                fbs[game.away.nameRaw].points += score.total;
            }

            if (fbs_name_set.has(game.home.nameRaw)) {
                let score = calculateScore(game.home, game.away, fbs_name_set, game, new_years_six);
                fbs[game.home.nameRaw].games.push(score);
                fbs[game.home.nameRaw].points += score.total;
            }
        }
    });
    console.log(fbs);
    portfolios.forEach(function (portfolio) {
        portfolio.points = portfolio.schools.map(school => fbs[school].points).reduce((a,b) => a + b);
        portfolio.schools.sort((a,b) => fbs[b].points - fbs[a].points);
    });
    portfolios.sort((a,b) => b.points - a.points);
    portfolios.forEach((portfolio, index) => {portfolio.rank = index + 1;});
    console.log(portfolios);

    $('#leaderboard_table').DataTable( {
        data: portfolios,
        columns: [
            { "data": "rank", "title": "Rank", className: "text-center" },
            { "data": "name", "title": "Name" },
            { "data": "schools", "title": "Portfolio", "render": li => li.map(school => `${school} (${fbs[school].points} / ${fbs[school].units})`).join(', ') },
            { "data": "points", "title": "Totals", "render": (data, type, row) => `${data} / ${row.schools.reduce((acc,school) => acc + fbs[school].units, 0)}` }
            ],
        "dom": 'lrtip',         <!-- removes the native search input box-->
        scrollResize: true,
        scrollX: true,
        scrollY: 100,
        scrollCollapse: true,
        paging: false,
        lengthChange: false
    });

    let details_team = "Air Force";

    $('#details_table').DataTable( {
        data: details_team === "" ? games.filter(game => game.gameState === 'final') : fbs[details_team].games,
        columns: [
            { "data": "startDate", "title": "Date" },
            { "data": "week", "title": "Week" },
            { "data": "score_string", "title": "Result" },
            { "data": "win_loss_record", "title": "W-L", className: "text-right" },
            { "data": "win", "title": "Win", className: "text-right" },
            { "data": "blowout", "title": "Blowout", className: "text-right" },
            { "data": "shutout", "title": "Shutout", className: "text-right" },
            { "data": "top25", "title": "Top 25", className: "text-right" },
            { "data": "bowl", "title": "Bowl", className: "text-right" },
            { "data": "total", "title": "Total", className: "text-right" }
            ],
        "dom": 'lrtip',         <!-- removes the native search input box-->
        scrollResize: true,
        scrollX: true,
        scrollY: 100,
        scrollCollapse: true,
        paging: false,
        lengthChange: false,
        "footerCallback": function ( row, data, start, end, display ) {

            let total = this.api()
                .column( 8, { page: 'current'} )
                .data()
                .reduce( function (a, b) {
                    return a + b;
                }, 0 );

            $( this.api().column( 8 ).footer() ).html(total);
        }
    });

    $('#summary_table').DataTable( {
        data: Object.keys(fbs).map(function (school) { return { 'name': school,
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
            { "data": "weeklies.0", "title": "1", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.1", "title": "2", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.2", "title": "3", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.3", "title": "4", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.4", "title": "5", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.5", "title": "6", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.6", "title": "7", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.7", "title": "8", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.8", "title": "9", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.9", "title": "10", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.10", "title": "11", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.11", "title": "12", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.12", "title": "13", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.13", "title": "14", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.14", "title": "15", className: "text-right", "defaultContent": "" },
            { "data": "weeklies.15", "title": "16", className: "text-right", "defaultContent": "" },
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
});

$(document).ready( function () {
    <!-- wire up the search box in template header  -->
    $('#search').on( 'keyup', function () {
        <!-- set table variable to the active/displayed table on page -->
        //~ table.search( this.value ).draw();
        $($.fn.dataTable.tables(true)).DataTable().search( this.value ).draw();
    } );

    <!-- adjust and redraw each tabs table when the tab is toggled (?) -->
    $(document).on('shown.bs.tab', 'a[data-toggle="tab"]', function (e) {
        $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust().draw();
    });

    // update data in details table when dropdown is changed
    $("#details").change(function() {
        let details_team = $(this).find(":selected").text();
        // clear data from details_table, reload with new selection, and redraw
        let datatable = $( "#details_table" ).DataTable();
        datatable.clear();  // .draw();
        datatable.rows.add(fbs[details_team].games);
        datatable.draw();   // columns.adjust().draw();
    });

} );
