/* jshint esnext: true, expr: true, sub: true */
/* globals $ */

const NumpyArray = function (...args) {  // header: {descr, fortran_order, shape}
    if (args[0].constructor === ArrayBuffer) this.initializeFromArrayBuffer(...args);
    else this.initializeFromFieldViews(...args);
};

NumpyArray.prototype.initializeFromArrayBuffer = function (buf, header) {
    const dataOffset = 10 + (new DataView(buf, 8)).getUint16(0, true);
    this.numpyHeader = String.fromCharCode.apply(null,new Uint8Array(buf.slice(10,dataOffset)));
    if (header === undefined) return console.log(this.numpyHeader);

    if (header.descr.constructor === String) header.descr = [['value', header.descr]];
    const types = header.descr.map(([field, type], i) => {
        const m = type.match(/^(.*?)(\d+)$/);
        try {return [m[1], parseInt(m[2])];}
        catch (e) {throw `'${type}' is not supported`;}
    });
    const totalWidth = types.reduce((acc, [type, width]) => acc + width, 0);

    const fieldView = j => {
        const [type, width] = types[j];
        const offset = types.slice(0, j).reduce((acc, [type, width]) => acc + width, 0);
        const err = `'${type}${width}' is not supported`;

        const mU = type.match(/^([<\|>])u$/);
        if (mU !== null) {
            if (! (width === 1 || width === 2 || width === 4)) throw err;

            const
            little = mU[1] !== '>',
            dv = new DataView(buf, dataOffset);

            return {
                1: i => dv.getUint8(i * totalWidth + offset, little),
                2: i => dv.getUint16(i * totalWidth + offset, little),
                4: i => dv.getUint32(i * totalWidth + offset, little)
            }[width];
        }

        const mI = type.match(/^([<\|>])i$/);
        if (mI !== null) {
            if (! (width === 1 || width === 2 || width === 4)) throw err;

            const
            little = mI[1] !== '>',
            dv = new DataView(buf, dataOffset);

            return {
                1: i => dv.getInt8(i * totalWidth + offset, little),
                2: i => dv.getInt16(i * totalWidth + offset, little),
                4: i => dv.getInt32(i * totalWidth + offset, little)
            }[width];
        }

        const mF = type.match(/^([<>])f$/);
        if (mF !== null) {
            if (! (width === 4 || width === 8)) throw err;

            const
            little = mF[1] !== '>',
            dv = new DataView(buf, dataOffset);

            return {
                4: i => dv.getFloat32(i * totalWidth + offset, little),
                8: i => dv.getFloat64(i * totalWidth + offset, little)
            }[width];
        }

        const mS = type.match(/^\|?[Sa]$/);
        if (mS !== null) {
            return i => String.fromCharCode.apply(
                null,
                new Uint8Array(buf.slice(dataOffset + i * totalWidth + offset,
                                         dataOffset + i * totalWidth + offset + width))
            );
        }

        throw err;
    };

    this.length = header.shape.reduce((prd, dim) => prd * dim, 1);  // n-D is reshaped into 1-D
    this.fieldViews = header.descr.map(([field, type], i) => [field, fieldView(i)]);
    this.updateGetByIndex();
};

NumpyArray.prototype.initializeFromFieldViews = function (length, fieldViews) {
    this.length = length;
    this.fieldViews = fieldViews;
    this.updateGetByIndex();
};

NumpyArray.prototype.updateGetByIndex = function () {
    const fv = this.fieldViews;
    if (fv.length === 1) {
        const view = fv[0][1];
        this.getByIndex = i => view(i);
    } else {
        this.getByIndex = i => fv.map(([field, view], j) => view(i));
    }
};

NumpyArray.prototype.get = function (arg) {
    if (arg.constructor === Array) {
        if (arg.reduce((acc, i) => acc && Number.isInteger(i), true)) {
            return arg.map((i, j) => this.getByIndex(i)); 
        }
        return this.getByFields(arg);
    } else if (Number.isInteger(arg)) {
        return this.getByIndex(arg);
    } else {
        return this.getByFields([arg]);
    }
};

NumpyArray.prototype.getByIndex = null;

NumpyArray.prototype.getByFields = function (flds) {
    const views_map = new Map(this.fieldViews);
    const new_views = flds.map((fd, i) => {
        if (! views_map.has(fd)) throw `'${fd}' is not a field`;
        return [fd, views_map.get(fd)];
    });
    return new NumpyArray(this.length, new_views);
};

// Use high order functions (reduce, map, filter...) with [...numpy_array]
NumpyArray.prototype[Symbol.iterator] = function* () {  
    for (let i = 0; i < this.length; i++) yield this.getByIndex(i);
};

NumpyArray.prototype.toArray = function () {return [...this];};

NumpyArray.getFromURL = (url, header) => {
    return new Promise((rsl, rjt) => {
        const r = new XMLHttpRequest();
        r.open('GET', url);
        r.responseType = 'arraybuffer';
        r.onload = () => rsl(new NumpyArray(r.response, header));
        r.onerror = rjt;
        r.send();
    });
};

NumpyArray.getFromURL('../npy/Charged Moves.npy', {
    descr: [
        ['Name', '|S22'], ['Type', '<i4'], ['Power', '<i4'], ['Duration', '<i4'], ['Start', '<i4'], ['Energy', '<i4']
    ],
    fortran_order: false,
    shape: [118,]
}).then(a => [...a].forEach(l => $('body').append(`<pre style="color: red">${l}</pre>`)));

NumpyArray.getFromURL('../npy/Species.npy', {
    descr: [
        ['Name', 'S10'], ['Id', '<i4'], ['Legend', '|i1'], ['Type 1', '<i4'],
        ['Type 2', '<i4'], ['HP', '<i4'], ['Attack', '<i4'], ['Defense', '<i4']
    ],
    fortran_order: false,
    shape: [118,]
}).then(a => [...a].forEach(l => $('body').append(`<pre style="color: blue">${l}</pre>`)));

                // descr: '<f8', shape: [19, 19]
