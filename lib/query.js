function Query(connection) {
    this.connection = connection;
    this.input = input;
    this.inputMany = inputMany;
    this.execute = execute;
    this.executeOne = executeOne;
    this.asyncExecute = asyncExecute;
    this.asyncExecuteOne = asyncExecuteOne;
    this.newTransaction = newTransaction;
    this.transExecute = transExecute;
    this.createQuery = createQuery;
    this.createQueryName = createQueryName;
    this.isJson = isJson;
    this.params = [];
    this.paramsName = [];

    function input(...parameters) {
        if (!parameters)
            throw new Exception('Parameter exception', 'Nenhum parâmetro informado.');

        if (parameters.length == 1 && (typeof parameters[0] != 'object' || parameters[0] == null)) {
            inputIndex(this, parameters[0]);
        } else if (parameters.length == 2 && typeof parameters[0] != 'object') {
            inputName(this, parameters[0], parameters[1]);
        } else if (typeof parameters[0] == 'object') {
            object(this, parameters[0], parameters[1]);
        }

        return this;
    }

    function inputMany(...value) {
        if (this.paramsName.length)
            throw new Exception('Parameter exception', 'Não utilize input e (inputName ou object) na mesma consulta');

        this.params = this.params.concat(value);
        return this;
    }

    //-----------FUNCS AUX------------------


    function inputIndex(query, value) {
        if (query.paramsName.length)
            throw new Exception('Parameter exception', 'Não utilize input e (inputName ou object) na mesma consulta');

        query.params.push(value);
    }

    function inputName(query, name, value, elem) {
        if (query.params.length)
            throw new Exception('Parameter exception', 'Não utilize input e inputName ou object na mesma consulta');

        query.paramsName.push({
            name,
            value,
            elem: elem
        });
    }

    function object(query, obj, prefix) {
        prefix = prefix || '';
        for (let i in obj) {
            inputName(query, prefix + i, obj[i]);
        }
    }

    //-----------------------------

    function execute(procedureName, callback) {
        this.connection.query(this[this.params.length ? 'createQuery' : 'createQueryName'](procedureName), this.params).then((data) => {
            callback(null, data);
        }).catch(function (err) {
            callback(err);
        });
    }

    function executeOne(procedureName, callback) {
        this.connection.oneOrNone(this[this.params.length ? 'createQuery' : 'createQueryName'](procedureName), this.params).then((data) => {
            callback(null, data);
        }).catch(function (err) {
            callback(err);
        });
    }

    async function asyncExecute(procedureName) {
        const returns = await this.connection.query(this[this.params.length ? 'createQuery' : 'createQueryName'](procedureName), this.params);

        if (returns[_prepareProcedureName(procedureName)] != null)
            return returns[_prepareProcedureName(procedureName)];

        return returns;
    }

    async function asyncExecuteOne(procedureName) {
        const returns = await this.connection.oneOrNone(this[this.params.length ? 'createQuery' : 'createQueryName'](procedureName), this.params);

        if (returns[_prepareProcedureName(procedureName)] != null)
            return returns[_prepareProcedureName(procedureName)];

        return returns;
    }

    /**
     * Retorna o nome da procedure para tratamento do retorno.
     * @param {String} procedureName 
     * @private
     */
    function _prepareProcedureName(procedureName) {
        const names = procedureName.split('.');

        return names.length > 1
            ? names[1].toLowerCase()
            : names[0].toLowerCase();
    }

    function createQuery(procedureName) {
        let paramsIndice = '';
        this.params && this.params.map((obj, i) => {
            paramsIndice += `$${(+i + 1)}, `;
        });
        paramsIndice = paramsIndice.slice(0, -2);

        return `SELECT * FROM ${procedureName}(${paramsIndice})`;
    }

    function createQueryName(procedureName) {
        let paramsIndice = '';
        this.paramsName.map(x => {
            paramsIndice += `${x.name} := ${(x.value == null || x.value == undefined ? 'NULL' : paramsResolve(x.value))}, `;
        });
        paramsIndice = paramsIndice.slice(0, -2);

        return `SELECT * FROM ${procedureName}(${paramsIndice})`;
    }

    function paramsResolve(value) {
        const setE = true;
        if (typeof value == 'object')
            value = JSON.stringify(value);

        if (isJson(value)) return `'${value}'`;

        if (typeof value == 'string')
            value = value.replace(/(\')|(\\')/g, "\\'");
        return `E'${value}'`;
    }

    function isJson(value) {
        try {
            return typeof JSON.parse(value) == 'object';
        } catch (error) {
            return false;
        }
    }
}

function Exception(name, message) {
    this.message = message;
    this.name = name;
}

//---------------- TRANSACTION ----------------------------------------------------

async function newTransaction(queries) {
    return new Promise((resolve, reject) => {
        this.connection.tx(t => {
            return t.batch(queries);
        })
            .then(data => resolve(data))
            .catch(error => reject(error));
    });
}

function transExecute(trans, procedureName) {
    return trans.query(this[this.params.length ? 'createQuery' : 'createQueryName'](procedureName));
}

module.exports = (conn) => {
    return new Query(conn);
};
