var request = require('request'),
    util = require('util'),
    fs = require('fs'),
    SPI = require('spi');

var interval = 1000*60*5,
    api_url = 'https://temp-api.herokuapp.com/submit',
    api_key = process.env.API_KEY || '',
    device = '/dev/spidev0.0';

if (!fs.existsSync(device)) {
    throw 'Error, SPI is not activated';
}

function read(spi, channel, callback) {
    if (spi === undefined) return;

    var mode = (8 + channel) << 4;
    var tx = new Buffer([1, mode, 0]);
    var rx = new Buffer([0, 0, 0]);

    spi.transfer(tx, rx, function(dev, buffer) {
        var value = ((buffer[1] & 3) << 8) + buffer[2];
        callback(value);
    })
}

function tmp36_temp(value) {
    var volts = (value * 3.3) / 1023;
    var temp = volts * 33.333;
    return temp.toFixed(2);
}

function get_volts(value) {
    var volts = (value * 3.3) / 1023;
    return volts.toFixed(2);
}

function collect_data() {
    var spi, t1, t2;

    console.log('collecting data...');

    spi = new SPI.Spi(device, [], function(s) { s.open(); });

    read(spi, 0, function(v1) {
        console.log('Sensor 1 is %s C (%s - %s v)', tmp36_temp(v1), v1, get_volts(v1));
        t1 = tmp36_temp(v1);

        read(spi, 1, function(v2) {
            console.log('Sensor 2 is %s C (%s - %s v)', tmp36_temp(v2), v2, get_volts(v2));
            t2 = tmp36_temp(v2);
        });
    });

    request.post(
        api_url,
        {
            json: {
                api_key: api_key,
                t1: t1,
                t2: t2
            }
        },
        function(err, res, body) {
            if (!err && res.statusCode == 200) {
                console.log(body);
            } else {
                console.log('Something went wrong with API', err, res);
            }

            spi.close();
            setTimeout(collect_data, interval);
        }
    );
}

collect_data();
