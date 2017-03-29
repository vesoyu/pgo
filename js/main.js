/* jshint esnext: true, expr: true, sub: true */
/* globals $ */

let
spieces = null,
quickMoves = null,
chargedMoves = null;

const
isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
detachedDOMs = [],
tapHdl = {},   // A better click then the default
config = $.extend({
    selectedAttackerMoves: [],
    viewState: 1  // 1: SHOW_ALL, 0: SHOW_SELECTED, 2: EDIT
}, JSON.parse(localStorage.getItem('config'))),

getSpieces = new Promise(rsl => $.get('data/species.json', rsl)),
// getTypes = new Promise(rsl => $.get('data/types.json', rsl)),
getQuickMoves = new Promise(rsl => $.get('data/quick_moves.json', rsl)),
getChargedMoves = new Promise(rsl => $.get('data/charged_moves.json', rsl)),
documentReady = new Promise(rsl => $(document).ready(rsl)),

$_ = id => document.getElementById(id),
saveConfig = () => localStorage.setItem('config', JSON.stringify(config)),
tapBubbling = elm => {
   bubbling: while (elm) {
       for (let sel in tapHdl) {
           if (elm.matches(sel)) {
               tapHdl[sel](elm);
               break bubbling;
           }
       }
       elm = elm.parentNode;
   }
},

spriteURL = id => `https://assets-lmcrhbacy2s.stackpathdns.com/img/pokemon/icons/96x96/${id}.png`,

abbr = word => {
   const
   a = word.split(' '),
   conn = (w, width) => {
      if (w.length <= width + 1) {
         return w;
      } else {
         const m = w.match(/^[AEIOUaeiou]+[wy]*/),
         [hd, tl] = m === null ? ['', w] : [w.slice(0, m[0].length), w.slice(m[0].length)];

         return tl.split(/[aeiou]+[wy]*/).reduce((acc, p) => acc.length < width ? acc + p : acc, hd);
      }
   };
   return a.map((w, i) => i === a.length - 1 ? conn(w, -a.length * 2 + 7) : w[0]).join(' ');
},

updateSVG = () => {
    const
    ih = window.innerHeight,
    st = window.scrollY;

    detachedDOMs.forEach((d, i) => {
        const
        r = d.row,
        y = r.__queryCache.top,
        s0 = r.__queryCache.onScreen,
        s1 = (y < (ih + st + 300)) && (y > (st - 72 - 100));

        if (!r.__queryCache.visible) return;
        if (!s0 && s1) {
            d.cells.forEach(c => r.appendChild(c));
        }
        if (s0 && !s1) while (r.firstChild) {
            r.removeChild(r.firstChild);
        }

        r.__queryCache.onScreen = s1;
    });
},

updateView = () => {
    const
    wr = $('#attackers_wrapper'),
    lambda = 0.5,
    ss = wr.find('> div');

    switch (config.viewState) {
        case 0:
            ss.each((i, t) => {
                const
                all_hidden = $(t).find('tr')
                .toArray()
                .reduce((a, r) => {
                    const hidden = config.selectedAttackerMoves.indexOf(r.__movesetData.id) < 0;
                    r.__queryCache.visible = !hidden;
                    r.className = hidden ? 'hidden' : '';
                    return a && hidden;
                }, true);
                t.className = all_hidden ? 'hidden' : '';
            });
            break;
        case 1:
            ss.each((i, s) => s.className='');
            detachedDOMs.forEach(d => [d.row.className, d.row.__queryCache.visible] = ['', true]);
            break;
        case 2:
            ss.each((i, s) => s.className='');
            detachedDOMs.forEach(d => {
                const
                r = d.row,
                hidden = config.selectedAttackerMoves.indexOf(r.__movesetData.id) < 0;

                r.className = hidden ? 'grayout' : '';
                r.__queryCache.visible = true;
            });
            break;
    }

    ss.toArray()
    .map((t, i) => {
        const
        rs = $(t).find('tr:not(.hidden)').toArray(),
        v = rs.reduce(
            ([lvr, cpr, n], r) => [lvr + r.__movesetData.lvr, cpr + r.__movesetData.cpr, n + 1],
            [0, 0, 0]
        );

        return v[2] === 0 ? [0, t] : [lambda * Math.exp(v[0] / v[2])  + (1 - lambda) * v[1] / v[2], t];
    })
    .sort((a, b) => a[0] - b[0])
    .forEach(([v, t]) => wr.append(t));

    $('#wrapper').attr('view-state', config.viewState);
    wr.find('> div').each((i, t) => $(t).find('div.a > span').html(config.viewState === 0 ? '' : '#' + (i + 1)));
    detachedDOMs.forEach((d, i) => d.row.__queryCache.top = $(d.row).offset().top);

    updateSVG();
},

initFromWrapper = () => {
    const
    d = $('#defender_info'),
    w = window.innerWidth - 494 - 33;

    document.title = spieces[parseInt(d.data('id')) - 1];

    d.find('img').attr('src', spriteURL(d.data('id')));
    d.append(`
<svg width=${w} height=36 viewBox="0 0 ${w} 36" xmlns="http://www.w3.org/2000/svg">
    <rect x=0 y=0 width=${w} height=36 rx=8 ry=8 fill="#74a9f3"/>
    <style>text {font-family: AvenirNext-DemiBold; font-size: 28; fill: white}</style>
    <text x=8 y=28 >2</text>
    <text x=${w / 3 - 9} y=28>1</text>
    <text x=${w / 3 * 2 - 20} y=28>&frac12;</text>
    <text x=${w - 31} y=28>&frac14;</text>
</svg>`);

    detachedDOMs.length = 0;
    $('#attackers_wrapper > div').each((i, s) => {
        const S = $(s);
        S.find('div.a > img').attr('src', spriteURL(S.attr('id').substr(1)));
        S.find('tr').each((i, r) => {
            const
            R = $(r),
            L = JSON.parse(r.dataset.m),
            d = {
              id: L[0], qm: L[1], cm: L[2], lvr: L[3],
              cpr: L[4], cpx: L[5], cpn: L[6], legacy: L[7]
            },
            q = quickMoves[d.qm],
            c = chargedMoves[d.cm];

            r.__movesetData = d;
            r.__queryCache = {top: 0, visible: false, onScreen: false};

            detachedDOMs.push({cells: [
                $(`<td class='q${d.legacy ? ' l' : ''}'><div class=t${q[1]} title="${q[0]}">${abbr(q[0])}</div></td>`).get(0),
                $(`<td class='c${d.legacy ? ' l' : ''}'><div class=t${c[1]} title="${c[0]}">${abbr(c[0])}</div></td>`).get(0),
                $(`<td class='r'><svg width=${w} height=62 viewBox="0 0 ${w} 62" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <clipPath id=b>
            <rect x=0 y=0 width=${w} height=62 rx=8 ry=8/>
            <linearGradient id="g1">
                <stop offset="0%"  stop-color=#74a9f3/>
                <stop offset="100%" stop-color=#7489f3/>
            </linearGradient>
            <linearGradient id="g2">
                <stop offset="0%"  stop-color=#98bff6/>
                <stop offset="100%" stop-color=#98aff6/>
            </linearGradient>
        </clipPath>
    </defs>
    <rect x=0 y=0 width=${w} height=62 fill=#e9e9e9 clip-path=url(#b)/>
    <rect x=${(1 - d.cpx) / 3 * w} y=0 width=${(d.cpx - d.cpn) / 3 * w} height=62 fill=url(#g2) clip-path=url(#b)/>
    <rect x=0 y=0 width=${(1 - d.cpx) / 3 * w} height=62 fill=url(#g1) clip-path=url(#b)/>
    <line x1=${w / 3} x2=${w / 3} y1=0 y2=62 stroke=white stroke-width=3 clip-path=url(#b)/>
    <line x1=${w * 2 / 3} x2=${w * 2 / 3} y1=0 y2=62 stroke=white stroke-width=3 clip-path=url(#b)/>
    <circle cx=${(1 - d.lvr) / 3 * w} cy=31 fill=white stroke-width=3 stroke=#7489f3 clip-path=url(#b) r=9/>
</svg></td>`).get(0)
            ], row: r});
        });
    });

    updateView();
},
    
updateSelectPanel = () => {
    const a = $_('atk-dfd').__which;

    $('#atk-dfd').html(['Choose a defender', 'Choose an attacker:'][a]);
    $('#select-panel > img').each((i, m) => {
        const
        T = $('#s' + m.dataset.id);

        if (T.length === 0 || a === 1 && T.hasClass('hidden')) m.className = 'hidden';
        else m.className = '';
    });
},

toggleSelectPanel = (elm, forcedClose) => {
    const sp = $_('select-panel');

    if (sp.className === '' || forcedClose) {
        sp.className = 'hidden';
        $('#attackers_wrapper').show();
        window.scrollTo(0, forcedClose ? 0 : sp.__oldScrollTop);
    }
    else {
        $_('atk-dfd').__which = 1;
        updateSelectPanel();
        sp.__oldScrollTop = window.scrollY;
        sp.className = '';
        $('#attackers_wrapper').hide();
        window.scrollTo(0, 48);
    }
},

loadDefender = url => {
    toggleSelectPanel(null, true);
    $.ajax({
        url: url,
        dataType: 'html',
        success: t => {
            $('#wrapper').replaceWith(t.match(/--->([\s\S]*)<!---/)[1]);
            initFromWrapper();
            history.replaceState(null, document.title, url);
        },
        error: () => location.href = url
    });
};

Promise
.all([documentReady, getSpieces, getQuickMoves, getChargedMoves])
.then(pre => {
    [spieces, quickMoves, chargedMoves] = pre.slice(1);
    {
        let h = '';
        for (let i = 1; i <= 251; i++) {h += `<img data-id=${i} src="${spriteURL(i)}"/>`;}
        $_('select-panel').insertAdjacentHTML('beforeend', h);
    }

    initFromWrapper();

    $(document).scroll(e => {
        $_('defender_info').className = window.scrollY >= 48 ? 'scrolled' : ''; 
        updateSVG();
    });

    tapHdl['#defender_info'] = toggleSelectPanel;

    tapHdl['#atk-dfd'] = s => {
        const a = $_('atk-dfd');
        a.__which = 1 - a.__which;
        updateSelectPanel();
    };

    tapHdl['#select-panel > img'] = m => {
        if (m.className === 'hidden') return;
        [
            () => {
                history.pushState(null, document.title, location.href);
                loadDefender(spieces[m.dataset.id - 1] + '.html');
            },
            () => {
                $_('select-panel').className = 'hidden';
                $('#attackers_wrapper').show();
                window.scrollTo(0, $('#s' + m.dataset.id).position().top - 96 - 25);
            }
        ][$_('atk-dfd').__which]();  // 0: choose a defender, 1: choose an attacker
    };

    tapHdl['tr'] = r => {
        if (config.viewState !== 2) return;

        const hidden = config.selectedAttackerMoves.indexOf(r.__movesetData.id) < 0;

        if (hidden) {
            config.selectedAttackerMoves.push(r.__movesetData.id);
            r.className = '';
        } else {
            config.selectedAttackerMoves = config.selectedAttackerMoves.filter(id => r.__movesetData.id !== id);
            r.className = 'grayout';
        }
        saveConfig();
    };

    tapHdl['rect'] = r => {
        console.log(r);
    };

    if (isMobile) {
        let touchStart = null;

        $(document).bind('touchstart', e => {
            const t = e.touches.item(0);
            touchStart = e;
        });

        $(document).bind('touchend', e => {
            if (touchStart === null) return;
            const
            t0 = touchStart.touches.item(0),
            t1 = e.changedTouches.item(0),
            dX = t1.clientX - t0.clientX,
            dY = t1.clientY - t0.clientY,
            rad = Math.atan2(dY, dX) / Math.PI,
            d = Math.sqrt(dX * dX + dY * dY),
            radA = 1 / 4,
            radB = - 1 / 6,
            aw = $('#attackers_wrapper').is(':visible');

            if (d > 75 && rad < radA && rad > radB && aw) {
                config.viewState = Math.max(0, config.viewState - 1);
                saveConfig();
                updateView();
            }
            if (d > 75 && (rad < radA - 1 || rad > 1 + radB) && aw) {
                config.viewState = Math.min(2, config.viewState + 1);
                saveConfig();
                updateView();
            }

            if (d <= 1) tapBubbling(touchStart.target);

            touchStart === null;
        });
    } else {
        $(document).click(e => tapBubbling(e.target));

        $('body').keypress(e => {
            if (!$('#attackers_wrapper').is(':visible')) return;
            switch (e.which) {
                case 49:
                    config.viewState = 0;
                    break;
                case 50:
                    config.viewState = 1;
                    break;
                case 51:
                    config.viewState = 2;
                    break;
            }
            saveConfig();
            updateView();
        });
    }

    window.onpopstate = () => loadDefender(location.href);
});
